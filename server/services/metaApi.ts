import fetch from "node-fetch";

// Facebook Graph API base URL
const FB_API_VERSION = "v18.0";
const FB_GRAPH_API = `https://graph.facebook.com/${FB_API_VERSION}`;

// Get these from environment variables
const META_APP_ID = process.env.META_APP_ID || "";
const META_APP_SECRET = process.env.META_APP_SECRET || "";
const META_REDIRECT_URI = process.env.META_REDIRECT_URI || "http://localhost:5000/api/auth/callback";
const META_AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID || "";

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
    const params = new URLSearchParams({
      client_id: META_APP_ID,
      redirect_uri: META_REDIRECT_URI,
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
    const params = new URLSearchParams({
      client_id: META_APP_ID,
      client_secret: META_APP_SECRET,
      redirect_uri: META_REDIRECT_URI,
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
    // Use the ad account ID from environment variable if available
    let adAccountId = META_AD_ACCOUNT_ID;
    
    // Fallback to fetching accounts if no environment variable is set
    if (!adAccountId) {
      const adAccounts = await this.getAdAccounts(accessToken);
      if (adAccounts.length === 0) {
        throw new Error("No ad accounts found for this user");
      }
      adAccountId = adAccounts[0];
    }
    
    // Make sure adAccountId format is correct (should start with 'act_')
    if (!adAccountId.startsWith('act_')) {
      adAccountId = `act_${adAccountId}`;
    }

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
    return data.data.map((campaign: any) => {
      // Parse dates if they exist, or set to null
      const startTime = campaign.start_time ? new Date(campaign.start_time) : null;
      const endTime = campaign.end_time ? new Date(campaign.end_time) : null;
      
      return {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        budget: parseInt(campaign.daily_budget || campaign.lifetime_budget || "0") / 100, // Convert cents to dollars
        startTime: startTime,
        endTime: endTime,
        objective: campaign.objective,
        metaData: campaign,
      };
    });
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
    console.log(`Creating ad creative for video asset ${videoAssetId} in campaign ${campaignId}`);
    
    // Use the ad account ID from environment variable if available
    let adAccountId = META_AD_ACCOUNT_ID;
    console.log(`Using ad account ID from env: ${adAccountId}`);
    
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
    
    // Get the ad set ID from the campaign
    console.log(`Fetching ad sets for campaign ${campaignId}...`);
    const campaignResponse = await fetch(
      `${FB_GRAPH_API}/${campaignId}/adsets?fields=id&access_token=${accessToken}`,
      {
        method: "GET",
      }
    );

    console.log(`Ad sets response status: ${campaignResponse.status} ${campaignResponse.statusText}`);
    
    if (!campaignResponse.ok) {
      const errorText = await campaignResponse.text();
      console.error(`Error fetching ad sets: ${errorText}`);
      throw new Error(`Failed to get ad sets: ${errorText}`);
    }

    const adSetsData = await campaignResponse.json() as any;
    console.log(`Found ${adSetsData.data.length} ad sets for campaign ${campaignId}`);
    
    if (adSetsData.data.length === 0) {
      throw new Error(`No ad sets found for campaign ${campaignId}`);
    }
    
    // Use the first ad set
    const adSetId = adSetsData.data[0].id;
    console.log(`Using ad set ID: ${adSetId}`);
    
    // Create the ad creative
    console.log(`Creating ad in account ${adAccountId} with ad set ${adSetId} and video ${videoAssetId}`);
    
    const adData = {
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
          page_id: "PAGE_ID", // This needs to be a valid page ID
        },
      },
      status: "ACTIVE",
    };
    
    console.log(`Sending ad creation request with data:`, JSON.stringify(adData));
    
    const response = await fetch(
      `${FB_GRAPH_API}/${adAccountId}/ads?access_token=${accessToken}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(adData),
      }
    );

    console.log(`Ad creation response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error creating ad: ${errorText}`);
      throw new Error(`Failed to create ad: ${errorText}`);
    }

    const result = await response.json();
    console.log(`Ad creation successful:`, JSON.stringify(result));
    return result;
  }
}

export const metaApiService = new MetaApiService();
