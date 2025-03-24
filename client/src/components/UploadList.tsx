import { FilmIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FileUpload } from "@shared/schema";
import { formatFileSize } from "@/lib/utils";

interface UploadListProps {
  files: FileUpload[];
  onRemoveFile: (fileId: string) => void;
  uploadProgress: Record<string, number>;
}

export default function UploadList({ files, onRemoveFile, uploadProgress }: UploadListProps) {
  if (files.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 space-y-4">
      {files.map((file) => {
        const progress = uploadProgress[file.id] || 0;
        const isUploading = file.status === 'uploading';
        const isReady = file.status === 'ready';
        const isError = file.status === 'error';
        const isCompleted = file.status === 'completed';
        
        let statusText = 'Processing...';
        let progressColor = 'bg-primary';
        
        if (isReady) {
          statusText = 'Ready to assign';
          progressColor = 'bg-secondary';
        } else if (isError) {
          statusText = 'Upload failed';
          progressColor = 'bg-error';
        } else if (isCompleted) {
          statusText = 'Launched';
          progressColor = 'bg-secondary';
        }

        return (
          <div key={file.id} className="bg-gray-50 rounded-md p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center">
                <FilmIcon className="text-primary mr-2" />
                <div>
                  <p className="text-sm font-medium text-neutral-900">{file.name}</p>
                  <p className="text-xs text-neutral-300">{formatFileSize(file.size)}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-neutral-300 hover:text-error"
                onClick={() => onRemoveFile(file.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="mt-3">
              <Progress 
                value={progress} 
                className="h-2 mb-1" 
                indicatorClassName={progressColor}
              />
              <div className="flex justify-between text-xs text-neutral-300">
                <span className={isReady || isCompleted ? 'text-secondary' : (isError ? 'text-error' : '')}>
                  {statusText}
                </span>
                <span>{Math.round(progress)}%</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
