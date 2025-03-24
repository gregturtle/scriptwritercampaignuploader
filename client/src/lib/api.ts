import { apiRequest } from "./queryClient";

// Auth API
export const getAuthStatus = async () => {
  const response = await apiRequest('GET', '/api/auth/status', undefined);
  return response.json();
};

// Meta Auth API
export const getLoginUrl = async () => {
  const response = await apiRequest('GET', '/api/auth/meta/login-url', undefined);
  return response.json();
};

// Google Drive Auth API
export const getGoogleDriveAuthUrl = async () => {
  const response = await apiRequest('GET', '/api/auth/google/login-url', undefined);
  return response.json();
};

export const logout = async () => {
  const response = await apiRequest('POST', '/api/auth/logout', undefined);
  return response.json();
};

// Campaigns API
export const getCampaigns = async () => {
  const response = await apiRequest('GET', '/api/campaigns', undefined);
  return response.json();
};

// File Upload API
export const uploadFile = async (file: File, onProgress?: (progress: number) => void) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/files/upload', {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || response.statusText);
  }

  return response.json();
};

// Google Drive API
export const getGoogleDriveFiles = async () => {
  const response = await apiRequest('GET', '/api/google-drive/files', undefined);
  return response.json();
};

export const importGoogleDriveFile = async (fileId: string) => {
  const response = await apiRequest('POST', '/api/google-drive/download', { fileId });
  return response.json();
};

// Creative Launch API
export const launchCreatives = async (files: string[], campaignIds: string[]) => {
  const response = await apiRequest('POST', '/api/creatives/launch', {
    files,
    campaignIds
  });
  return response.json();
};
