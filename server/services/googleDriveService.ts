import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

interface DriveFile {
  id: string;
  name: string;
  size?: string;
  mimeType: string;
  webViewLink?: string;
  thumbnailLink?: string;
  modifiedTime?: string;
}

interface DownloadResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

class GoogleDriveService {
  private drive: any;
  private auth: any;

  constructor() {
    this.initializeAuth();
  }

  private initializeAuth() {
    try {
      const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
      if (!serviceAccountJson) {
        console.log('Google Service Account JSON not configured for Drive access');
        return;
      }

      const credentials = JSON.parse(serviceAccountJson);
      
      this.auth = new google.auth.GoogleAuth({
        credentials,
        scopes: [
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/drive.file'
        ],
      });

      this.drive = google.drive({ version: 'v3', auth: this.auth });
      console.log('Google Drive service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Google Drive service:', error);
    }
  }

  /**
   * Check if Google Drive is properly configured
   */
  isConfigured(): boolean {
    return !!(this.drive && this.auth);
  }

  /**
   * List video files from the specified Google Drive folder
   */
  async listVideosFromFolder(folderId: string): Promise<{
    id: string;
    name: string;
    size?: string;
    modifiedTime?: string;
    webViewLink?: string;
  }[]> {
    if (!this.isConfigured()) {
      throw new Error('Google Drive service is not properly configured');
    }

    try {
      console.log(`Listing videos from Google Drive folder: ${folderId}`);
      
      const response = await this.drive.files.list({
        q: `'${folderId}' in parents and mimeType contains 'video/' and trashed=false`,
        fields: 'files(id,name,size,modifiedTime,webViewLink)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        orderBy: 'modifiedTime desc'
      });

      const files = response.data.files || [];
      console.log(`Found ${files.length} video files in Google Drive folder`);
      
      return files.map(file => ({
        id: file.id!,
        name: file.name!,
        size: file.size,
        modifiedTime: file.modifiedTime,
        webViewLink: file.webViewLink
      }));
      
    } catch (error) {
      console.error('Error listing videos from Google Drive folder:', error);
      throw new Error(`Failed to list videos from Google Drive: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List video files from Google Drive
   */
  async listVideoFiles(pageSize: number = 50): Promise<DriveFile[]> {
    if (!this.isConfigured()) {
      throw new Error('Google Drive service not configured');
    }

    try {
      const response = await this.drive.files.list({
        q: "mimeType contains 'video/' and trashed=false",
        pageSize,
        fields: 'files(id, name, size, mimeType, webViewLink, thumbnailLink, modifiedTime)',
        orderBy: 'modifiedTime desc'
      });

      return response.data.files || [];
    } catch (error: any) {
      console.error('Error listing video files from Google Drive:', error);
      
      // Handle specific API not enabled error
      if (error.code === 403 && error.errors?.[0]?.reason === 'accessNotConfigured') {
        throw new Error('Google Drive API is not enabled. Please enable it in your Google Cloud Console at https://console.developers.google.com/apis/api/drive.googleapis.com/overview');
      }
      
      throw new Error(`Failed to list video files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search for video files by name
   */
  async searchVideoFiles(query: string): Promise<DriveFile[]> {
    if (!this.isConfigured()) {
      throw new Error('Google Drive service not configured');
    }

    try {
      const searchQuery = `mimeType contains 'video/' and trashed=false and name contains '${query}'`;
      
      const response = await this.drive.files.list({
        q: searchQuery,
        pageSize: 20,
        fields: 'files(id, name, size, mimeType, webViewLink, thumbnailLink, modifiedTime)',
        orderBy: 'modifiedTime desc'
      });

      return response.data.files || [];
    } catch (error) {
      console.error('Error searching video files in Google Drive:', error);
      throw new Error(`Failed to search video files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Download a video file from Google Drive to local storage
   */
  async downloadVideoFile(fileId: string, fileName: string): Promise<DownloadResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Google Drive service not configured'
      };
    }

    try {
      console.log(`Attempting to download file ${fileId} with name ${fileName}`);
      
      // First try to get file metadata to check if we have access
      let fileMetadata;
      try {
        fileMetadata = await this.drive.files.get({
          fileId,
          fields: 'name, size, mimeType, parents',
          supportsAllDrives: true
        });
        console.log(`File metadata retrieved: ${JSON.stringify(fileMetadata.data)}`);
      } catch (metaError) {
        console.error('Error getting file metadata:', metaError);
        
        // If we can't get metadata, it's likely a permissions issue
        // Try to find the file in the folder listing to see if it exists
        try {
          const folderFiles = await this.listVideosFromFolder('1AIe9UvmYnBJiJyD1rMzLZRNqKDw-BWJh');
          const foundFile = folderFiles.find(f => f.id === fileId);
          
          if (foundFile) {
            const serviceAccountEmail = this.getServiceAccountEmail();
            return {
              success: false,
              error: `PERMISSION ISSUE: File exists but service account doesn't have download permissions. Please share each AI-generated video file directly with the service account email: ${serviceAccountEmail}`
            };
          } else {
            return {
              success: false,
              error: 'File not found in the specified folder'
            };
          }
        } catch (searchError) {
          return {
            success: false,
            error: `Cannot access file: ${metaError instanceof Error ? metaError.message : 'Unknown error'}`
          };
        }
      }

      if (!fileMetadata.data.mimeType?.includes('video/')) {
        return {
          success: false,
          error: 'File is not a video'
        };
      }

      // Create uploads directory if it doesn't exist
      const uploadsDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      // Generate safe filename
      const safeFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = path.join(uploadsDir, safeFileName);

      // Download the file with Shared Drive support
      console.log(`Downloading file content for ${fileId}`);
      const response = await this.drive.files.get({
        fileId,
        alt: 'media',
        supportsAllDrives: true
      }, {
        responseType: 'stream'
      });

      // Write stream to file
      const writeStream = fs.createWriteStream(filePath);
      
      return new Promise((resolve) => {
        response.data.pipe(writeStream)
          .on('finish', () => {
            console.log(`Downloaded video file: ${safeFileName} to ${filePath}`);
            resolve({
              success: true,
              filePath
            });
          })
          .on('error', (error: Error) => {
            console.error('Error writing downloaded file:', error);
            resolve({
              success: false,
              error: `Failed to save file: ${error.message}`
            });
          });
      });

    } catch (error) {
      console.error('Error downloading video from Google Drive:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Get file information by ID
   */
  async getFileInfo(fileId: string): Promise<DriveFile | null> {
    if (!this.isConfigured()) {
      throw new Error('Google Drive service not configured');
    }

    try {
      const response = await this.drive.files.get({
        fileId,
        fields: 'id, name, size, mimeType, webViewLink, thumbnailLink, modifiedTime',
        supportsAllDrives: true
      });

      return response.data;
    } catch (error) {
      console.error('Error getting file info from Google Drive:', error);
      return null;
    }
  }

  /**
   * Format file size for display
   */
  formatFileSize(sizeInBytes: string): string {
    const size = parseInt(sizeInBytes);
    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    } else if (size < 1024 * 1024 * 1024) {
      return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    } else {
      return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }
  }

  /**
   * Create a new folder for video uploads or use existing one
   */
  async createOrGetVideoFolder(folderName: string = 'AI Generated Videos'): Promise<string> {
    try {
      // First, search for existing folder
      const searchResponse = await this.drive.files.list({
        q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)'
      });

      if (searchResponse.data.files && searchResponse.data.files.length > 0) {
        const folderId = searchResponse.data.files[0].id!;
        console.log(`Found existing folder: ${folderName}`);
        console.log(`Folder link: https://drive.google.com/drive/folders/${folderId}`);
        return folderId;
      }

      // Create new folder if it doesn't exist
      console.log(`Creating new folder: ${folderName}`);
      const folderMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder'
      };

      const folderResponse = await this.drive.files.create({
        requestBody: folderMetadata,
        fields: 'id,webViewLink'
      });

      console.log(`Created new folder with ID: ${folderResponse.data.id}`);
      console.log(`Folder link: https://drive.google.com/drive/folders/${folderResponse.data.id}`);
      return folderResponse.data.id!;
    } catch (error) {
      console.error('Error creating/finding folder:', error);
      throw error;
    }
  }

  /**
   * Upload a video file to a specific Google Drive folder by ID using resumable upload
   */
  async uploadVideoToSpecificFolder(filePath: string, fileName: string, folderId: string): Promise<{ id: string; webViewLink: string }> {
    if (!this.isConfigured()) {
      throw new Error('Google Drive service not configured');
    }

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    try {
      console.log(`Uploading ${fileName} to Google Drive folder ${folderId} using resumable upload`);

      const fileStats = fs.statSync(filePath);
      const fileSizeInBytes = fileStats.size;
      console.log(`File size: ${(fileSizeInBytes / (1024 * 1024)).toFixed(2)} MB`);

      const fileMetadata = {
        name: fileName,
        parents: [folderId]
      };

      const media = {
        mimeType: 'video/mp4',
        body: fs.createReadStream(filePath)
      };

      // Use resumable upload with Shared Drive support
      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id,webViewLink',
        uploadType: 'resumable',        // Critical for large files
        supportsAllDrives: true         // Required for Shared Drives
      });

      console.log('Using resumable upload with Shared Drive support');

      console.log(`Successfully uploaded ${fileName} to Google Drive. File ID: ${response.data.id}`);

      return {
        id: response.data.id!,
        webViewLink: response.data.webViewLink!
      };
    } catch (error) {
      console.error('Error uploading video to Google Drive:', error);
      throw new Error(`Failed to upload video: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload a video file to Google Drive (creates folder if needed)
   */
  async uploadVideoToFolder(filePath: string, fileName: string, folderName?: string): Promise<{ id: string; webViewLink: string }> {
    if (!this.isConfigured()) {
      throw new Error('Google Drive service not configured');
    }

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    try {
      // Get or create the folder
      const folderId = await this.createOrGetVideoFolder(folderName || 'AI Generated Videos');
      
      console.log(`Uploading ${fileName} to Google Drive folder ${folderId}`);

      const fileMetadata = {
        name: fileName,
        parents: [folderId]
      };

      const fileStats = fs.statSync(filePath);
      const fileSizeInBytes = fileStats.size;
      console.log(`File size: ${(fileSizeInBytes / (1024 * 1024)).toFixed(2)} MB`);

      const media = {
        mimeType: 'video/mp4',
        body: fs.createReadStream(filePath)
      };

      // Use resumable upload for all video files
      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id,webViewLink',
        uploadType: 'resumable',        // Critical for large files
        supportsAllDrives: true         // Required for Shared Drives
      });

      console.log('Using resumable upload for video file');

      console.log(`Successfully uploaded ${fileName} to Google Drive. File ID: ${response.data.id}`);

      return {
        id: response.data.id!,
        webViewLink: response.data.webViewLink!
      };
    } catch (error) {
      console.error('Error uploading video to Google Drive:', error);
      throw new Error(`Failed to upload video: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check account access and quota
   */
  async getStorageInfo(): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('Google Drive service not configured');
    }

    try {
      const response = await this.drive.about.get({
        fields: 'storageQuota, user'
      });

      return response.data;
    } catch (error) {
      console.error('Error getting Google Drive storage info:', error);
      throw new Error(`Failed to get storage info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get the service account email for permission sharing
   */
  getServiceAccountEmail(): string {
    if (!this.isConfigured()) {
      return 'Service account not configured';
    }

    try {
      const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}');
      return credentials.client_email || 'Email not found';
    } catch (error) {
      return 'Error reading service account email';
    }
  }
}

export const googleDriveService = new GoogleDriveService();