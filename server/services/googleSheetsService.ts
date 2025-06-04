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
              title: 'Campaign Performance',
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
      'Date',
      'Campaign ID',
      'Campaign Name',
      'Spend ($)',
      'Impressions',
      'Clicks',
      'Conversions',
      'CTR (%)',
      'CPC ($)',
      'CPM ($)',
    ];

    const request = {
      spreadsheetId,
      range: 'Campaign Performance!A1:J1',
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
   * Append performance data to existing sheet
   */
  async appendPerformanceData(spreadsheetId: string, data: CampaignPerformanceData[]) {
    try {
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
        spreadsheetId,
        range: 'Campaign Performance!A:J',
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
      // Clear existing data (keep headers)
      await this.sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: 'Campaign Performance!A2:J',
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
        spreadsheetId,
        range: 'Campaign Performance!A2:J',
        valueInputOption: 'RAW',
        resource: {
          values,
        },
      };

      await this.sheets.spreadsheets.values.update(request);

      return {
        updatedRows: values.length,
        updatedRange: `Campaign Performance!A2:J${values.length + 1}`,
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
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId,
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