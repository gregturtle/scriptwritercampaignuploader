import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import FormData from "form-data";

// Facebook Graph API base URL
const FB_API_VERSION = "v18.0";
const FB_GRAPH_API = `https://graph.facebook.com/${FB_API_VERSION}`;

// Get ad account ID from environment variable
const META_AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID || "";

class FileService {
  /**
   * Upload a file to Meta's asset library
   */
  async uploadFileToMeta(accessToken: string, filePath: string): Promise<{ id: string }> {
    try {
      console.log(`Starting Meta file upload for: ${filePath}`);
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`File does not exist at path: ${filePath}`);
      }
      
      const fileStats = fs.statSync(filePath);
      console.log(`File size: ${fileStats.size} bytes, Last modified: ${fileStats.mtime}`);
      
      // Use the ad account ID from environment variable if available
      let adAccountId = META_AD_ACCOUNT_ID;
      console.log(`Using ad account ID: ${adAccountId}`);
      
      // Fallback to fetching accounts if no environment variable is set
      if (!adAccountId) {
        console.log("No ad account ID in environment, fetching from API...");
        const adAccounts = await this.getAdAccounts(accessToken);
        if (adAccounts.length === 0) {
          throw new Error("No ad accounts found for this user");
        }
        adAccountId = adAccounts[0];
        console.log(`Fetched ad account ID: ${adAccountId}`);
      }
      
      // Make sure adAccountId format is correct (should start with 'act_')
      if (!adAccountId.startsWith('act_')) {
        adAccountId = `act_${adAccountId}`;
        console.log(`Formatted ad account ID: ${adAccountId}`);
      }
      
      // Read the file
      console.log("Creating read stream for file...");
      const fileStream = fs.createReadStream(filePath);
      const formData = new FormData();
      
      formData.append("access_token", accessToken);
      formData.append("file", fileStream);
      
      console.log(`Sending request to: ${FB_GRAPH_API}/${adAccountId}/advideos`);
      const response = await fetch(`${FB_GRAPH_API}/${adAccountId}/advideos`, {
        method: "POST",
        body: formData as any,
      });

      console.log(`Response status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Upload error response: ${errorText}`);
        throw new Error(`Failed to upload file to Meta: ${errorText}`);
      }

      const data = await response.json() as any;
      console.log(`Upload successful. Received ID: ${data.id}`);
      return { id: data.id };
    } catch (error) {
      console.error("Error uploading file to Meta:", error);
      throw error;
    }
  }

  /**
   * Upload an image to Meta's ad images library
   */
  async uploadImageToMeta(accessToken: string, imagePath: string): Promise<{hash: string}> {
    try {
      console.log(`Starting Meta image upload for: ${imagePath}`);
      
      // Check if file exists
      if (!fs.existsSync(imagePath)) {
        throw new Error(`Image file does not exist at path: ${imagePath}`);
      }
      
      const fileStats = fs.statSync(imagePath);
      console.log(`Image size: ${fileStats.size} bytes, Last modified: ${fileStats.mtime}`);
      
      // Validate image format and size
      const fileExtension = path.extname(imagePath).toLowerCase();
      if (!['.jpg', '.jpeg', '.png'].includes(fileExtension)) {
        throw new Error(`Invalid image format. Only JPEG and PNG are supported. Got: ${fileExtension}`);
      }
      
      // Check file size (8MB limit)
      const maxSize = 8 * 1024 * 1024; // 8MB in bytes
      if (fileStats.size > maxSize) {
        throw new Error(`Image file too large. Maximum size is 8MB. Got: ${Math.round(fileStats.size / 1024 / 1024)}MB`);
      }
      
      // Use the ad account ID from environment variable if available
      let adAccountId = META_AD_ACCOUNT_ID;
      console.log(`Using ad account ID: ${adAccountId}`);
      
      // Fallback to fetching accounts if no environment variable is set
      if (!adAccountId) {
        console.log("No ad account ID in environment, fetching from API...");
        const adAccounts = await this.getAdAccounts(accessToken);
        if (adAccounts.length === 0) {
          throw new Error("No ad accounts found for this user");
        }
        adAccountId = adAccounts[0];
        console.log(`Fetched ad account ID: ${adAccountId}`);
      }
      
      // Make sure adAccountId format is correct (should start with 'act_')
      if (!adAccountId.startsWith('act_')) {
        adAccountId = `act_${adAccountId}`;
        console.log(`Formatted ad account ID: ${adAccountId}`);
      }
      
      // Read the image file as bytes
      console.log("Creating read stream for image bytes...");
      const fileStream = fs.createReadStream(imagePath);
      const formData = new FormData();
      
      formData.append("access_token", accessToken);
      formData.append("bytes", fileStream); // Use 'bytes' field as expected by Meta API
      
      console.log(`Sending image request to: ${FB_GRAPH_API}/${adAccountId}/adimages`);
      const response = await fetch(`${FB_GRAPH_API}/${adAccountId}/adimages`, {
        method: "POST",
        body: formData as any,
      });

      console.log(`Image upload response status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Image upload error response: ${errorText}`);
        throw new Error(`Failed to upload image to Meta: ${errorText}`);
      }

      const data = await response.json() as any;
      console.log(`Image upload successful. Full response:`, JSON.stringify(data));
      
      // Parse the correct image hash from the response
      // Meta API returns the hash in the 'images' object or directly as 'hash'
      let imageHash: string;
      if (data.images && Object.keys(data.images).length > 0) {
        // Response format: { "images": { "image_hash": {...} } }
        imageHash = Object.keys(data.images)[0];
      } else if (data.hash) {
        // Response format: { "hash": "image_hash" }
        imageHash = data.hash;
      } else {
        throw new Error(`Invalid response format from Meta API: ${JSON.stringify(data)}`);
      }
      
      console.log(`Image upload successful. Received hash: ${imageHash}`);
      return { hash: imageHash };
    } catch (error) {
      console.error("Error uploading image to Meta:", error);
      throw error;
    }
  }
  
  /**
   * Get ad account ID for the user
   * (Duplicate from metaApi.ts to avoid circular dependencies)
   */
  private async getAdAccounts(accessToken: string): Promise<string[]> {
    const response = await fetch(`${FB_GRAPH_API}/me/adaccounts?fields=id&access_token=${accessToken}`, {
      method: "GET",
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get ad accounts: ${errorText}`);
    }

    const data = await response.json() as any;
    return data.data.map((account: any) => account.id);
  }
}

export const fileService = new FileService();
