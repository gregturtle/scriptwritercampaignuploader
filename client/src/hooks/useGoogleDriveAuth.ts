import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getGoogleDriveAuthUrl, getGoogleDriveFiles, importGoogleDriveFile } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

export function useGoogleDriveAuth() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Get Google Drive login URL
  const loginUrlQuery = useQuery({
    queryKey: ['/api/auth/google/login-url'],
    queryFn: getGoogleDriveAuthUrl,
    enabled: false,
  });

  // Get Google Drive files
  const filesQuery = useQuery({
    queryKey: ['/api/files/google-drive'],
    queryFn: getGoogleDriveFiles,
    retry: 1,
  });

  // Display error toast when query fails
  useEffect(() => {
    if (filesQuery.isError) {
      toast({
        title: 'Error fetching Google Drive files',
        description: 'Please make sure you are authenticated with Google Drive.',
        variant: 'destructive',
      });
    }
  }, [filesQuery.isError, toast]);

  // Import file from Google Drive
  const importFileMutation = useMutation({
    mutationFn: (fileId: string) => importGoogleDriveFile(fileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
      toast({
        title: 'Success',
        description: 'File imported from Google Drive',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error importing file',
        description: error.message || 'An error occurred while importing the file',
        variant: 'destructive',
      });
    },
  });

  // Login to Google Drive
  const loginToGoogleDrive = async () => {
    setIsAuthenticating(true);
    try {
      const data = await loginUrlQuery.refetch();
      if (data.data?.url) {
        window.location.href = data.data.url;
      }
    } catch (error) {
      toast({
        title: 'Authentication Error',
        description: 'Failed to get Google Drive login URL',
        variant: 'destructive',
      });
      setIsAuthenticating(false);
    }
  };

  // Import file from Google Drive
  const importFile = (fileId: string) => {
    importFileMutation.mutate(fileId);
  };

  return {
    loginToGoogleDrive,
    importFile,
    isAuthenticating,
    isLoading: filesQuery.isLoading,
    isError: filesQuery.isError,
    files: filesQuery.data || [],
    isImporting: importFileMutation.isPending,
  };
}