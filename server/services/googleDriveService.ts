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
          'https://www.googleapis.com/auth/drive.readonly',
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
      // Get file metadata first
      const fileMetadata = await this.drive.files.get({
        fileId,
        fields: 'name, size, mimeType'
      });

      if (!fileMetadata.data.mimeType?.includes('video/')) {
        return {
          success: false,
          error: 'File is not a video'
        };
      }

      // Create backgrounds directory if it doesn't exist
      const backgroundsDir = path.join(process.cwd(), 'uploads', 'backgrounds');
      if (!fs.existsSync(backgroundsDir)) {
        fs.mkdirSync(backgroundsDir, { recursive: true });
      }

      // Generate safe filename
      const safeFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = path.join(backgroundsDir, safeFileName);

      // Download the file
      const response = await this.drive.files.get({
        fileId,
        alt: 'media'
      }, {
        responseType: 'stream'
      });

      // Write stream to file
      const writeStream = fs.createWriteStream(filePath);
      
      return new Promise((resolve) => {
        response.data.pipe(writeStream)
          .on('finish', () => {
            console.log(`Downloaded video file: ${safeFileName}`);
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
        fields: 'id, name, size, mimeType, webViewLink, thumbnailLink, modifiedTime'
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

      const media = {
        mimeType: 'video/mp4',
        body: fs.createReadStream(filePath)
      };

      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id,webViewLink'
      });

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
}

export const googleDriveService = new GoogleDriveService();