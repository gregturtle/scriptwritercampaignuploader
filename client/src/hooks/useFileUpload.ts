import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { FileUpload, ActivityLog } from "@shared/schema";

export function useFileUpload() {
  const [uploadedFiles, setUploadedFiles] = useState<FileUpload[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  // Upload file mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const fileId = Date.now().toString();
      const formData = new FormData();
      formData.append("file", file);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/files/upload", true);

      // Track upload progress
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(prev => ({
            ...prev,
            [fileId]: progress
          }));
        }
      };

      // Promise to track completion
      const uploadPromise = new Promise<{fileId: string, path: string}>((resolve, reject) => {
        xhr.onload = function() {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              resolve({ fileId: response.fileId, path: response.path });
            } catch (e) {
              reject(new Error("Invalid response format"));
            }
          } else {
            reject(new Error(`Upload failed with status: ${xhr.status}`));
          }
        };
        
        xhr.onerror = function() {
          reject(new Error("Network error occurred during upload"));
        };
      });

      xhr.send(formData);
      
      // Add file to state immediately with uploading status
      const newFile: FileUpload = {
        id: fileId,
        name: file.name,
        size: file.size,
        type: file.type,
        status: 'uploading',
        path: '',
        createdAt: new Date().toISOString()
      };

      setUploadedFiles(prev => [...prev, newFile]);
      
      // Wait for upload to complete
      const result = await uploadPromise;
      
      return {
        ...newFile,
        id: result.fileId || fileId,
        status: 'ready' as const,
        path: result.path
      };
    }
  });

  // Handle file upload
  const uploadFiles = async (files: File[], logCallback?: (log: ActivityLog) => void) => {
    for (const file of files) {
      try {
        if (!file.name.endsWith('.mov')) {
          const errorLog: ActivityLog = {
            id: Date.now().toString(),
            type: 'error',
            message: `File "${file.name}" failed validation - wrong format, only .mov files are supported`,
            timestamp: new Date().toISOString()
          };
          
          if (logCallback) logCallback(errorLog);
          continue;
        }

        const result = await uploadMutation.mutateAsync(file);
        
        // Update file status
        setUploadedFiles(prev => 
          prev.map(f => f.id === result.id ? { ...f, status: 'ready', path: result.path } : f)
        );
        
        const successLog: ActivityLog = {
          id: Date.now().toString(),
          type: 'success',
          message: `File "${file.name}" uploaded successfully`,
          timestamp: new Date().toISOString()
        };
        
        if (logCallback) logCallback(successLog);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        // Update file status to error
        setUploadedFiles(prev => 
          prev.map(f => f.name === file.name && f.status === 'uploading' 
            ? { ...f, status: 'error' } 
            : f
          )
        );
        
        const errorLog: ActivityLog = {
          id: Date.now().toString(),
          type: 'error',
          message: `Failed to upload "${file.name}": ${errorMessage}`,
          timestamp: new Date().toISOString()
        };
        
        if (logCallback) logCallback(errorLog);
      }
    }
  };

  // Remove file
  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
    setUploadProgress(prev => {
      const { [fileId]: _, ...rest } = prev;
      return rest;
    });
  };

  return {
    uploadedFiles,
    uploadProgress,
    uploadFiles,
    removeFile,
    isUploading: uploadMutation.isPending
  };
}
