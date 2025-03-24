import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import FormData from "form-data";

// Facebook Graph API base URL
const FB_API_VERSION = "v18.0";
const FB_GRAPH_API = `https://graph.facebook.com/${FB_API_VERSION}`;

class FileService {
  /**
   * Upload a file to Meta's asset library
   */
  async uploadFileToMeta(accessToken: string, filePath: string): Promise<{ id: string }> {
    try {
      // First get ad accounts
      const adAccounts = await this.getAdAccounts(accessToken);

      if (adAccounts.length === 0) {
        throw new Error("No ad accounts found for this user");
      }

      // For simplicity, use the first ad account
      const adAccountId = adAccounts[0];
      
      // Read the file
      const fileStream = fs.createReadStream(filePath);
      const formData = new FormData();
      
      formData.append("access_token", accessToken);
      formData.append("file", fileStream);
      
      const response = await fetch(`${FB_GRAPH_API}/${adAccountId}/advideos`, {
        method: "POST",
        body: formData as any,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to upload file to Meta: ${errorText}`);
      }

      const data = await response.json() as any;
      return { id: data.id };
    } catch (error) {
      console.error("Error uploading file to Meta:", error);
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
