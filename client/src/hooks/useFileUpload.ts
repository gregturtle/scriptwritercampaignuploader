import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { FileUpload, FrontendActivityLog } from "@shared/schema";

export function useFileUpload() {
  const [uploadedFiles, setUploadedFiles] = useState<FileUpload[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  // Upload file mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const tempFileId = Date.now().toString(); // Temporary ID for tracking before server assigns real ID
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
            [tempFileId]: progress
          }));
        }
      };

      // Promise to track completion
      const uploadPromise = new Promise<{fileId: string, name: string, size: number, path: string}>((resolve, reject) => {
        xhr.onload = function() {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              console.log("Upload response:", response);
              resolve({ 
                fileId: response.fileId, 
                name: response.name,
                size: response.size,
                path: response.path 
              });
            } catch (e) {
              console.error("Error parsing response:", e);
              reject(new Error("Invalid response format"));
            }
          } else {
            console.error("Upload failed with status:", xhr.status, xhr.responseText);
            reject(new Error(`Upload failed with status: ${xhr.status}`));
          }
        };
        
        xhr.onerror = function() {
          console.error("Network error during upload");
          reject(new Error("Network error occurred during upload"));
        };
      });

      xhr.send(formData);
      
      // Add file to state immediately with uploading status
      const newFile: FileUpload = {
        id: tempFileId,
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
      console.log("Upload complete, server assigned ID:", result.fileId);
      
      // Return the finalized file data with server ID
      return {
        id: result.fileId,
        name: file.name,
        size: parseInt(result.size.toString()), // Ensure it's a number
        type: file.type,
        status: 'ready' as const,
        path: result.path,
        createdAt: new Date().toISOString(),
        tempId: tempFileId // Keep the temp ID for proper state updates
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
        
        // Need to properly update the file in state - the temporary ID is replaced with the server-assigned ID
        setUploadedFiles(prev => {
          // First remove the temp one
          const filtered = prev.filter(f => f.id !== result.tempId);
          // Add the new one with proper server ID
          return [...filtered, {
            id: result.id,
            name: result.name,
            size: parseInt(result.size.toString()), // Ensure it's a number
            type: file.type,
            status: 'ready',
            path: result.path,
            createdAt: new Date().toISOString()
          }];
        });
        
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
