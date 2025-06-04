import { metaApiService } from './metaApi';
import { googleSheetsService, type CampaignPerformanceData } from './googleSheetsService';

export interface PerformanceReportOptions {
  dateRange?: {
    since: string; // YYYY-MM-DD format
    until: string; // YYYY-MM-DD format
  };
  campaignIds?: string[]; // If not provided, gets all campaigns
  spreadsheetId?: string; // If not provided, creates new sheet
}

export interface PerformanceReportResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
  dataExported: number;
  dateRange: { since: string; until: string };
  createdNew: boolean;
}

class PerformanceReportService {
  /**
   * Generate and export performance report to Google Sheets
   */
  async generateReport(
    accessToken: string, 
    options: PerformanceReportOptions
  ): Promise<PerformanceReportResult> {
    try {
      console.log('Starting performance report generation...');
      
      // If no date range provided, use maximum available range (last 2 years)
      let dateRange = options.dateRange;
      if (!dateRange) {
        const today = new Date();
        const twoYearsAgo = new Date(today);
        twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
        
        dateRange = {
          since: twoYearsAgo.toISOString().split('T')[0],
          until: today.toISOString().split('T')[0],
        };
        console.log(`No date range provided, using maximum range: ${dateRange.since} to ${dateRange.until}`);
      }
      
      // Get campaign insights from Meta
      let insights: any[];
      
      if (options.campaignIds && options.campaignIds.length > 0) {
        console.log(`Fetching insights for ${options.campaignIds.length} specific campaigns`);
        insights = await metaApiService.getCampaignInsights(
          accessToken, 
          options.campaignIds, 
          dateRange!
        );
      } else {
        console.log('Fetching insights for all campaigns in ad account');
        insights = await metaApiService.getAdAccountInsights(
          accessToken, 
          dateRange!
        );
      }

      console.log(`Retrieved ${insights.length} insight records from Meta`);

      // Transform Meta insights to our format
      const performanceData: CampaignPerformanceData[] = insights.map(insight => {
        // Extract conversions from actions array
        let conversions = 0;
        if (insight.actions && Array.isArray(insight.actions)) {
          const conversionAction = insight.actions.find((action: any) => 
            action.action_type === 'offsite_conversion.fb_pixel_purchase' ||
            action.action_type === 'app_install' ||
            action.action_type === 'lead' ||
            action.action_type === 'complete_registration'
          );
          conversions = conversionAction ? parseInt(conversionAction.value) || 0 : 0;
        }

        return {
          campaignId: insight.campaign_id || '',
          campaignName: insight.campaign_name || '',
          spend: parseFloat(insight.spend || '0'),
          impressions: parseInt(insight.impressions || '0'),
          clicks: parseInt(insight.clicks || '0'),
          conversions,
          ctr: parseFloat(insight.ctr || '0'),
          cpc: parseFloat(insight.cpc || '0'),
          cpm: parseFloat(insight.cpm || '0'),
          date: insight.date_start || new Date().toISOString().split('T')[0],
        };
      });

      console.log(`Transformed ${performanceData.length} records for export`);

      // Handle Google Sheets export
      let spreadsheetId = options.spreadsheetId;
      let spreadsheetUrl = '';
      let createdNew = false;

      if (!spreadsheetId) {
        // Create new spreadsheet
        console.log('Creating new Google Sheets document');
        const titleDateRange = dateRange ? `${dateRange.since} to ${dateRange.until}` : 'All Historical Data';
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        const sheetResult = await googleSheetsService.createPerformanceSheet(
          `Meta Campaign Performance - ${titleDateRange} - ${timestamp}`
        );
        spreadsheetId = sheetResult.spreadsheetId!;
        spreadsheetUrl = sheetResult.url!;
        createdNew = true;
        console.log(`Created new spreadsheet: ${spreadsheetId}`);
        
        // Add data to new spreadsheet
        console.log('Adding performance data to new spreadsheet');
        await googleSheetsService.appendPerformanceData(spreadsheetId, performanceData);
      } else {
        // Use existing spreadsheet
        console.log(`Using existing spreadsheet: ${spreadsheetId}`);
        const sheetInfo = await googleSheetsService.getSpreadsheetInfo(spreadsheetId);
        spreadsheetUrl = sheetInfo.url!;
        
        // Append data to existing spreadsheet (don't clear existing data)
        console.log('Appending performance data to existing spreadsheet');
        await googleSheetsService.appendPerformanceData(spreadsheetId, performanceData);
      }

      console.log(`Successfully exported ${performanceData.length} records to Google Sheets`);

      return {
        spreadsheetId,
        spreadsheetUrl,
        dataExported: performanceData.length,
        dateRange: dateRange!,
        createdNew,
      };
    } catch (error) {
      console.error('Error generating performance report:', error);
      throw error;
    }
  }

  /**
   * Schedule automatic daily reports
   */
  async scheduleAutomaticReport(
    accessToken: string,
    spreadsheetId: string,
    campaignIds?: string[]
  ): Promise<void> {
    // Get yesterday's data
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateString = yesterday.toISOString().split('T')[0];

    const options: PerformanceReportOptions = {
      dateRange: {
        since: dateString,
        until: dateString,
      },
      campaignIds,
      spreadsheetId,
    };

    console.log(`Running automatic report for ${dateString}`);
    await this.generateReport(accessToken, options);
    console.log('Automatic report completed');
  }

  /**
   * Get date range presets
   */
  getDateRangePresets() {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const lastWeekStart = new Date(today);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    
    const lastMonthStart = new Date(today);
    lastMonthStart.setDate(lastMonthStart.getDate() - 30);

    const formatDate = (date: Date) => date.toISOString().split('T')[0];

    return {
      yesterday: {
        since: formatDate(yesterday),
        until: formatDate(yesterday),
      },
      last7Days: {
        since: formatDate(lastWeekStart),
        until: formatDate(yesterday),
      },
      last30Days: {
        since: formatDate(lastMonthStart),
        until: formatDate(yesterday),
      },
      thisMonth: {
        since: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`,
        until: formatDate(today),
      },
    };
  }
}

export const performanceReportService = new PerformanceReportService();