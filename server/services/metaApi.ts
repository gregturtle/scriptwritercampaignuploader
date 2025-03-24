import fetch from "node-fetch";

// Facebook Graph API base URL
const FB_API_VERSION = "v18.0";
const FB_GRAPH_API = `https://graph.facebook.com/${FB_API_VERSION}`;

// Get these from environment variables
const META_APP_ID = process.env.META_APP_ID || "";
const META_API_KEY = process.env.META_API_KEY || "";

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
const getRedirectUri = () => {
  // Use provided URI if available
  if (process.env.META_REDIRECT_URI) {
    return process.env.META_REDIRECT_URI;
  }
  
  // Otherwise build it from base URL
  return `${getBaseUrl()}/api/auth/callback`;
};

// Required permissions for Meta Marketing API
const PERMISSIONS = [
  "ads_management",
  "ads_read",
  "public_profile",
  "business_management",
  "catalog_management",
];

class MetaApiService {
  /**
   * Generate the login URL for Meta OAuth
   */
  getLoginUrl(): string {
    const redirectUri = getRedirectUri();
    console.log(`Using redirect URI: ${redirectUri}`);
    
    const params = new URLSearchParams({
      client_id: META_APP_ID,
      redirect_uri: redirectUri,
      scope: PERMISSIONS.join(","),
      response_type: "code",
      state: Math.random().toString(36).substring(2),
    });

    return `https://www.facebook.com/${FB_API_VERSION}/dialog/oauth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  }> {
    const redirectUri = getRedirectUri();
    
    const params = new URLSearchParams({
      client_id: META_APP_ID,
      client_secret: META_API_KEY, // Using API key instead of app secret
      redirect_uri: redirectUri,
      code,
    });

    const response = await fetch(`${FB_GRAPH_API}/oauth/access_token?${params.toString()}`, {
      method: "GET",
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to exchange code for token: ${errorText}`);
    }

    const data = await response.json() as any;
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in || 3600, // Default to 1 hour if not provided
    };
  }

  /**
   * Get ad account ID for the user
   */
  async getAdAccounts(accessToken: string): Promise<string[]> {
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

  /**
   * Get all campaigns for the user
   */
  async getCampaigns(accessToken: string): Promise<any[]> {
    // First get ad accounts
    const adAccounts = await this.getAdAccounts(accessToken);

    if (adAccounts.length === 0) {
      throw new Error("No ad accounts found for this user");
    }

    // For simplicity, use the first ad account
    const adAccountId = adAccounts[0];

    // Get campaigns for the ad account
    const fields = "id,name,status,objective,daily_budget,lifetime_budget,start_time,end_time";
    const response = await fetch(
      `${FB_GRAPH_API}/${adAccountId}/campaigns?fields=${fields}&access_token=${accessToken}`,
      {
        method: "GET",
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get campaigns: ${errorText}`);
    }

    const data = await response.json() as any;
    
    // Format campaigns
    return data.data.map((campaign: any) => ({
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      budget: parseInt(campaign.daily_budget || campaign.lifetime_budget || "0") / 100, // Convert cents to dollars
      startTime: campaign.start_time,
      endTime: campaign.end_time,
      objective: campaign.objective,
      metaData: campaign,
    }));
  }
  
  /**
   * Upload an image or video to Meta Ad Account
   */
  async uploadAdCreative(
    accessToken: string, 
    adAccountId: string, 
    filePath: string
  ): Promise<any> {
    // In a real implementation, we'd use form-data to upload the file
    // This is a simplified version that assumes we have a public URL to the file
    const response = await fetch(
      `${FB_GRAPH_API}/${adAccountId}/advideos?access_token=${accessToken}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          file_url: filePath,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to upload creative: ${errorText}`);
    }

    return await response.json();
  }
  
  /**
   * Create an ad creative in Meta
   */
  async createAdCreative(
    accessToken: string,
    campaignId: string,
    videoAssetId: string,
    name: string
  ): Promise<any> {
    // First get ad accounts
    const adAccounts = await this.getAdAccounts(accessToken);

    if (adAccounts.length === 0) {
      throw new Error("No ad accounts found for this user");
    }

    // For simplicity, use the first ad account
    const adAccountId = adAccounts[0];
    
    // Get the ad set ID from the campaign
    const campaignResponse = await fetch(
      `${FB_GRAPH_API}/${campaignId}/adsets?fields=id&access_token=${accessToken}`,
      {
        method: "GET",
      }
    );

    if (!campaignResponse.ok) {
      const errorText = await campaignResponse.text();
      throw new Error(`Failed to get ad sets: ${errorText}`);
    }

    const adSetsData = await campaignResponse.json() as any;
    
    if (adSetsData.data.length === 0) {
      throw new Error(`No ad sets found for campaign ${campaignId}`);
    }
    
    // Use the first ad set
    const adSetId = adSetsData.data[0].id;
    
    // Create the ad creative
    const response = await fetch(
      `${FB_GRAPH_API}/${adAccountId}/ads?access_token=${accessToken}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: `Ad for ${name}`,
          adset_id: adSetId,
          creative: {
            object_story_spec: {
              video_data: {
                video_id: videoAssetId,
                title: name,
                message: "Check out our new product!",
                call_to_action: {
                  type: "LEARN_MORE",
                  value: {
                    link: "https://example.com",
                  },
                },
              },
              page_id: "PAGE_ID", // In reality, you'd need to get the page ID
            },
          },
          status: "ACTIVE",
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create ad: ${errorText}`);
    }

    return await response.json();
  }
}

export const metaApiService = new MetaApiService();
