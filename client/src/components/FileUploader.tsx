import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CloudUpload } from "lucide-react";

interface FileUploaderProps {
  onFilesSelected: (files: File[]) => void;
}

export default function FileUploader({ onFilesSelected }: FileUploaderProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = () => {
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(false);
    
    const files = Array.from(e.dataTransfer.files);
    const validFiles = files.filter(file => file.name.endsWith('.mov'));
    
    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      const validFiles = files.filter(file => file.name.endsWith('.mov'));
      
      if (validFiles.length > 0) {
        onFilesSelected(validFiles);
      }
      
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div
      className={cn(
        "border-2 border-dashed border-neutral-200 rounded-lg p-6 text-center hover:border-primary transition-colors cursor-pointer",
        isDragActive && "border-primary bg-primary/5"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <div className="space-y-2">
        <CloudUpload className="h-12 w-12 mx-auto text-neutral-300" />
        <p className="text-sm text-neutral-300 font-medium">Drag and drop .mov files here</p>
        <p className="text-xs text-neutral-300">or</p>
        <Button type="button" className="bg-primary hover:bg-primary/90">
          Browse Files
        </Button>
        <input
          type="file"
          className="hidden"
          ref={fileInputRef}
          accept=".mov"
          multiple
          onChange={handleFileInputChange}
        />
        <p className="text-xs text-neutral-300 mt-2">Only .mov files are supported</p>
      </div>
    </div>
  );
}
