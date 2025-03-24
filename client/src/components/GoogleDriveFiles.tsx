import { useGoogleDriveAuth } from '@/hooks/useGoogleDriveAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { formatFileSize } from '@/lib/utils';
import { SiGoogledrive } from 'react-icons/si';
import { Loader2, Film, FileVideo, Import } from 'lucide-react';

interface GoogleDriveFilesProps {
  onImportComplete?: () => void;
}

export default function GoogleDriveFiles({ onImportComplete }: GoogleDriveFilesProps) {
  const { 
    loginToGoogleDrive, 
    importFile, 
    isAuthenticating, 
    isLoading, 
    isError, 
    files, 
    isImporting 
  } = useGoogleDriveAuth();

  const handleImport = (fileId: string) => {
    importFile(fileId);
    if (onImportComplete) {
      onImportComplete();
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-2 text-sm text-muted-foreground">Loading Google Drive files...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SiGoogledrive className="h-5 w-5 text-red-500" />
            Connect to Google Drive
          </CardTitle>
          <CardDescription>
            Access your .mov files in Google Drive
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            You need to connect to your Google Drive account to browse and import files.
          </p>
          <Button 
            onClick={loginToGoogleDrive} 
            disabled={isAuthenticating}
            className="w-full"
          >
            {isAuthenticating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <SiGoogledrive className="mr-2 h-4 w-4" />
                Connect to Google Drive
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (files.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SiGoogledrive className="h-5 w-5 text-blue-500" />
            No .MOV Files Found
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No video files were found in your Google Drive. Upload a .mov file to your Google Drive and try again.
          </p>
        </CardContent>
        <CardFooter>
          <Button variant="outline" onClick={() => loginToGoogleDrive()}>
            <SiGoogledrive className="mr-2 h-4 w-4" />
            Refresh Google Drive
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SiGoogledrive className="h-5 w-5 text-blue-500" />
          Google Drive Files
        </CardTitle>
        <CardDescription>
          Select a .mov file to import from your Google Drive
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {files.map((file: any) => (
            <div key={file.id} className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center space-x-3">
                {file.mimeType.includes('video') ? (
                  <Film className="h-8 w-8 text-blue-500" />
                ) : (
                  <FileVideo className="h-8 w-8 text-blue-500" />
                )}
                <div>
                  <p className="font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(parseInt(file.size || '0'))}
                  </p>
                </div>
              </div>
              <Button 
                size="sm" 
                onClick={() => handleImport(file.id)}
                disabled={isImporting}
              >
                {isImporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Import className="mr-1 h-3 w-3" />
                    Import
                  </>
                )}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="outline" onClick={() => loginToGoogleDrive()} className="w-full">
          <SiGoogledrive className="mr-2 h-4 w-4" />
          Refresh Google Drive Files
        </Button>
      </CardFooter>
    </Card>
  );
}