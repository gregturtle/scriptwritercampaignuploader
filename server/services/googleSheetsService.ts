import { google } from 'googleapis';

interface CampaignPerformanceData {
  campaignId: string;
  campaignName: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpm: number;
  date: string;
}

class GoogleSheetsService {
  private sheets: any;
  private auth: any;

  constructor() {
    this.initializeAuth();
  }

  /**
   * Extract spreadsheet ID from URL or return as-is if already an ID
   */
  extractSpreadsheetId(input: string): string {
    // If it's already a spreadsheet ID (just alphanumeric), return as-is
    if (/^[a-zA-Z0-9-_]+$/.test(input) && !input.includes('/')) {
      return input;
    }
    
    // Extract ID from Google Sheets URL
    const urlMatch = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (urlMatch) {
      return urlMatch[1];
    }
    
    // If no match found, assume it's already an ID
    return input;
  }

  private initializeAuth() {
    try {
      const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
      
      if (!serviceAccountJson) {
        throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON environment variable not found');
      }

      const credentials = JSON.parse(serviceAccountJson);
      
      this.auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
    } catch (error) {
      console.error('Failed to initialize Google Sheets authentication:', error);
      throw error;
    }
  }

  /**
   * Create a new Google Sheet for campaign performance data
   */
  async createPerformanceSheet(title: string = `Meta Campaign Performance - ${new Date().toISOString().split('T')[0]}`) {
    try {
      const request = {
        resource: {
          properties: {
            title,
          },
          sheets: [{
            properties: {
              title: 'CampaignPerformance',
            },
          }],
        },
      };

      const response = await this.sheets.spreadsheets.create(request);
      const spreadsheetId = response.data.spreadsheetId;

      // Add headers
      await this.addHeaders(spreadsheetId);

      return {
        spreadsheetId,
        url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
        title,
      };
    } catch (error) {
      console.error('Error creating Google Sheet:', error);
      throw error;
    }
  }

  /**
   * Add headers to the performance sheet
   */
  private async addHeaders(spreadsheetId: string) {
    const headers = [
      'Campaign Name',
      'Ad ID', 
      'Ad Name',
      'Creative Title',
      'Creative Description',
      'Spend',
      'App Installs',
      'Save Location',
      'Directions', 
      'Share',
      'Search 3wa',
    ];

    const request = {
      spreadsheetId,
      range: 'Sheet1!A1:K1',
      valueInputOption: 'RAW',
      resource: {
        values: [headers],
      },
    };

    await this.sheets.spreadsheets.values.update(request);

    // Format headers (bold)
    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [{
          repeatCell: {
            range: {
              sheetId: 0,
              startRowIndex: 0,
              endRowIndex: 1,
              startColumnIndex: 0,
              endColumnIndex: headers.length,
            },
            cell: {
              userEnteredFormat: {
                textFormat: {
                  bold: true,
                },
              },
            },
            fields: 'userEnteredFormat.textFormat.bold',
          },
        }],
      },
    });
  }

  /**
   * Get the first available sheet name from a spreadsheet
   */
  private async getFirstSheetName(spreadsheetId: string): Promise<string> {
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId,
      });
      
      if (response.data.sheets && response.data.sheets.length > 0) {
        return response.data.sheets[0].properties.title;
      }
      
      return 'Sheet1'; // Default fallback
    } catch (error) {
      console.error('Error getting sheet names:', error);
      return 'Sheet1'; // Default fallback
    }
  }

  /**
   * Append any data to existing sheet - simplified version
   */
  async appendSimpleData(spreadsheetId: string, data: any[]) {
    try {
      const cleanSpreadsheetId = this.extractSpreadsheetId(spreadsheetId);
      const sheetName = await this.getFirstSheetName(cleanSpreadsheetId);
      
      // First, find the next empty row by getting existing data
      const existingDataResponse = await this.sheets.spreadsheets.values.get({
        spreadsheetId: cleanSpreadsheetId,
        range: `${sheetName}!A:A`, // Just get column A to find last row
      });
      
      const existingRows = existingDataResponse.data.values || [];
      const nextRow = existingRows.length + 1; // +1 because sheets are 1-indexed
      
      console.log(`Adding ${data.length} rows starting at row ${nextRow} in sheet "${sheetName}"`);

      // Use update instead of append to place data at specific location
      const request = {
        spreadsheetId: cleanSpreadsheetId,
        range: `${sheetName}!A${nextRow}:L${nextRow + data.length - 1}`,
        valueInputOption: 'RAW',
        resource: {
          values: data,
        },
      };

      const response = await this.sheets.spreadsheets.values.update(request);

      return {
        updatedRows: data.length,
        updatedRange: response.data.updatedRange || 'Unknown',
      };
    } catch (error) {
      console.error('Error adding data to Google Sheet:', error);
      throw error;
    }
  }

  /**
   * Append performance data to existing sheet
   */
  async appendPerformanceData(spreadsheetId: string, data: CampaignPerformanceData[]) {
    try {
      const cleanSpreadsheetId = this.extractSpreadsheetId(spreadsheetId);
      const sheetName = await this.getFirstSheetName(cleanSpreadsheetId);
      
      const values = data.map(campaign => [
        campaign.date,
        campaign.campaignId,
        campaign.campaignName,
        campaign.spend,
        campaign.impressions,
        campaign.clicks,
        campaign.conversions,
        campaign.ctr,
        campaign.cpc,
        campaign.cpm,
      ]);

      const request = {
        spreadsheetId: cleanSpreadsheetId,
        range: `${sheetName}!A:J`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values,
        },
      };

      await this.sheets.spreadsheets.values.append(request);

      return {
        updatedRows: values.length,
        updatedRange: `Campaign Performance!A${values.length + 2}:J${values.length * 2 + 1}`,
      };
    } catch (error) {
      console.error('Error appending data to Google Sheet:', error);
      throw error;
    }
  }

  /**
   * Update existing sheet with new data (replaces all data except headers)
   */
  async updatePerformanceData(spreadsheetId: string, data: CampaignPerformanceData[]) {
    try {
      const cleanSpreadsheetId = this.extractSpreadsheetId(spreadsheetId);
      
      // Clear existing data (keep headers)
      await this.sheets.spreadsheets.values.clear({
        spreadsheetId: cleanSpreadsheetId,
        range: 'CampaignPerformance!A2:J',
      });

      // Add new data
      const values = data.map(campaign => [
        campaign.date,
        campaign.campaignId,
        campaign.campaignName,
        campaign.spend,
        campaign.impressions,
        campaign.clicks,
        campaign.conversions,
        campaign.ctr,
        campaign.cpc,
        campaign.cpm,
      ]);

      const request = {
        spreadsheetId: cleanSpreadsheetId,
        range: 'CampaignPerformance!A2:J',
        valueInputOption: 'RAW',
        resource: {
          values,
        },
      };

      await this.sheets.spreadsheets.values.update(request);

      return {
        updatedRows: values.length,
        updatedRange: `CampaignPerformance!A2:J${values.length + 1}`,
      };
    } catch (error) {
      console.error('Error updating Google Sheet:', error);
      throw error;
    }
  }

  /**
   * Get existing spreadsheet info
   */
  async getSpreadsheetInfo(spreadsheetId: string) {
    try {
      const cleanSpreadsheetId = this.extractSpreadsheetId(spreadsheetId);
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: cleanSpreadsheetId,
      });

      return {
        title: response.data.properties.title,
        url: response.data.spreadsheetUrl,
        sheets: response.data.sheets.map((sheet: any) => ({
          title: sheet.properties.title,
          sheetId: sheet.properties.sheetId,
        })),
      };
    } catch (error) {
      console.error('Error getting spreadsheet info:', error);
      throw error;
    }
  }
}

export const googleSheetsService = new GoogleSheetsService();
export type { CampaignPerformanceData };