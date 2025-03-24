import { google, drive_v3 } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

// Get these from environment variables
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";

// Helper function to determine the base URL of the application
const getBaseUrl = () => {
  // Check if running on Replit
  if (process.env.REPL_ID && process.env.REPL_SLUG) {
    // If REPL_OWNER is defined, use that for the domain
    if (process.env.REPL_OWNER) {
      return `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
    }
    // Otherwise use default Replit domain
    return `https://${process.env.REPL_SLUG}.replit.app`;
  }
  
  // Fallback to localhost for development
  return "http://localhost:5000";
};

// Dynamically build the redirect URI from the base URL
export const getRedirectUri = () => {
  // Use provided URI if available
  if (process.env.GOOGLE_REDIRECT_URI) {
    return process.env.GOOGLE_REDIRECT_URI;
  }
  
  // Otherwise build it from base URL
  return `${getBaseUrl()}/api/auth/google/callback`;
};

// OAuth2 scopes needed for Google Drive
const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.metadata.readonly'
];

class GoogleDriveService {
  /**
   * Create OAuth2 client
   */
  private createOAuth2Client() {
    return new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      getRedirectUri()
    );
  }

  /**
   * Generate the authorization URL
   */
  getAuthUrl(): string {
    const oauth2Client = this.createOAuth2Client();
    
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent', // Forces to approve the consent screen
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<{
    access_token: string;
    refresh_token?: string;
    expiry_date: number;
  }> {
    const oauth2Client = this.createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    
    if (!tokens.access_token) {
      throw new Error('No access token returned');
    }
    
    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date || Date.now() + 3600 * 1000, // Default to 1 hour
    };
  }

  /**
   * List .mov files in Google Drive
   */
  async listMovFiles(accessToken: string): Promise<drive_v3.Schema$File[]> {
    const oauth2Client = this.createOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });
    
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // Search for .mov files, limit to 50 results
    const response = await drive.files.list({
      q: "mimeType contains 'video/' and (name contains '.mov' or name contains '.MOV')",
      fields: 'files(id, name, mimeType, size, webViewLink, thumbnailLink, createdTime)',
      spaces: 'drive',
      pageSize: 50,
    });
    
    return response.data.files || [];
  }

  /**
   * Download a file from Google Drive to local storage
   */
  async downloadFile(accessToken: string, fileId: string, uploadDir: string): Promise<{
    localPath: string;
    name: string;
    size: number;
    type: string;
  }> {
    const oauth2Client = this.createOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });
    
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // Get file metadata
    const fileMetadata = await drive.files.get({
      fileId,
      fields: 'id, name, mimeType, size',
    });
    
    if (!fileMetadata.data.name) {
      throw new Error('File name not found');
    }

    // Create a unique filename to prevent overwrites
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const localPath = path.join(uploadDir, `${uniqueSuffix}-${fileMetadata.data.name}`);
    
    // Download the file content
    const response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' }
    );
    
    await new Promise<void>((resolve, reject) => {
      const dest = fs.createWriteStream(localPath);
      let progress = 0;
      
      // Pipe the file content to a local file
      (response.data as Readable)
        .on('data', (chunk) => {
          progress += chunk.length;
          // You could emit progress here
        })
        .on('end', () => {
          console.log(`Downloaded ${fileMetadata.data.name} from Google Drive`);
          resolve();
        })
        .on('error', (err) => {
          reject(err);
        })
        .pipe(dest);
    });
    
    return {
      localPath,
      name: fileMetadata.data.name,
      size: parseInt(fileMetadata.data.size || '0'),
      type: fileMetadata.data.mimeType || 'video/quicktime',
    };
  }
}

export const googleDriveService = new GoogleDriveService();