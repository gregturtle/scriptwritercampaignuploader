import { metaApiService } from './metaApi';
import { googleSheetsService, type CampaignPerformanceData } from './googleSheetsService';

export interface PerformanceReportOptions {
  dateRange?: {
    since: string; // YYYY-MM-DD format
    until: string; // YYYY-MM-DD format
  };
  campaignIds?: string[]; // If not provided, gets all campaigns
  spreadsheetId?: string; // If not provided, creates new sheet
  metrics?: string[]; // Selected metrics to include in report
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
        
        // Get basic campaign data first and export everything
        console.log('Getting basic campaign data from Meta');
        const allCampaigns = await metaApiService.getCampaigns(accessToken);
        
        // Filter campaigns if specific ones were selected
        const campaigns = options.campaignIds && options.campaignIds.length > 0 
          ? allCampaigns.filter(campaign => options.campaignIds!.includes(campaign.id))
          : allCampaigns;
        
        console.log(`Exporting ${campaigns.length} campaigns (filtered from ${allCampaigns.length} total)`);
        
        // Get ads (creatives) for selected campaigns
        console.log('Getting ads/creatives for selected campaigns');
        const campaignIds = campaigns.map(c => c.id);
        const ads = await metaApiService.getAdsForCampaigns(accessToken, campaignIds);
        console.log(`Found ${ads.length} ads across ${campaignIds.length} campaigns`);
        
        // Get performance data for each ad
        let adInsights: any[] = [];
        if (ads.length > 0) {
          const adIds = ads.map(ad => ad.id);
          try {
            adInsights = await metaApiService.getAdInsights(accessToken, adIds, dateRange!);
            console.log(`Retrieved ${adInsights.length} ad insight records`);
          } catch (error) {
            console.log('Ad insights API failed, proceeding with basic ad data only');
          }
        }

        // Get selected metrics or default set
        const selectedMetrics = options.metrics || ['spend', 'app_install'];
        console.log(`Using metrics: ${selectedMetrics.join(', ')}`);

        // Create metric calculation function
        const calculateMetricValue = (insight: any, metricId: string): string | number => {
          switch (metricId) {
            case 'spend':
              return parseFloat(insight.spend || '0').toFixed(2);
            case 'impressions':
              return parseInt(insight.impressions || '0');
            case 'clicks':
              return parseInt(insight.clicks || '0');
            case 'ctr':
              return parseFloat(insight.ctr || '0').toFixed(2);
            case 'cpc':
              return parseFloat(insight.cpc || '0').toFixed(2);
            case 'cpm':
              return parseFloat(insight.cpm || '0').toFixed(2);
            default:
              // Handle action-based metrics
              if (insight.actions && Array.isArray(insight.actions)) {
                const actionTypes = {
                  'app_install': ['app_install', 'mobile_app_install'],
                  'add_to_cart': ['add_to_cart'],
                  'purchase': ['purchase'],
                  'view_content': ['view_content'],
                  'search': ['search'],
                  'lead': ['lead'],
                  'complete_registration': ['complete_registration'],
                  'initiate_checkout': ['initiate_checkout'],
                  'add_to_wishlist': ['add_to_wishlist']
                };
                
                const actionType = actionTypes[metricId as keyof typeof actionTypes];
                if (actionType) {
                  const action = insight.actions.find((a: any) => actionType.includes(a.action_type));
                  return action ? parseInt(action.value || '0') : 0;
                }
              }
              return 0;
          }
        };

        // Create ad-level data export with selected metrics
        const adData = ads.map(ad => {
          // Find matching insights for this ad
          const adInsightData = adInsights.filter(insight => insight.ad_id === ad.id);
          
          // Calculate totals for selected metrics
          const metricValues: { [key: string]: number } = {};
          selectedMetrics.forEach(metricId => {
            let total = 0;
            adInsightData.forEach(insight => {
              const value = calculateMetricValue(insight, metricId);
              total += typeof value === 'string' ? parseFloat(value) : value;
            });
            metricValues[metricId] = total;
          });
          
          // Find the campaign this ad belongs to
          const campaign = campaigns.find(c => c.id === ad.campaign_id);
          
          // Build row data
          const rowData = [
            new Date().toISOString().split('T')[0], // Export date
            campaign?.name || 'Unknown Campaign',
            ad.id,
            ad.name || 'Unnamed Ad',
            ad.creative?.title || ad.creative?.name || 'No Title',
            ad.status,
          ];
          
          // Add metric values in the order they were selected
          selectedMetrics.forEach(metricId => {
            const value = metricValues[metricId];
            if (metricId === 'spend' || metricId === 'ctr' || metricId === 'cpc' || metricId === 'cpm') {
              rowData.push(value.toFixed(2));
            } else {
              rowData.push(value);
            }
          });
          
          // Add creative description at the end
          rowData.push(ad.creative?.body || 'No Description');
          
          return rowData;
        });

        const campaignData = adData;
        
        // Create dynamic header row based on selected metrics
        const metricLabels: { [key: string]: string } = {
          'spend': 'Spend',
          'app_install': 'App Installs',
          'add_to_cart': 'Add to Cart',
          'purchase': 'Purchases',
          'view_content': 'View Content',
          'search': 'Search',
          'lead': 'Leads',
          'complete_registration': 'Registrations',
          'initiate_checkout': 'Checkout Started',
          'add_to_wishlist': 'Add to Wishlist',
          'impressions': 'Impressions',
          'clicks': 'Clicks',
          'ctr': 'CTR',
          'cpc': 'CPC',
          'cpm': 'CPM'
        };

        const baseHeaders = ['Export Date', 'Campaign Name', 'Ad ID', 'Ad Name', 'Creative Title', 'Status'];
        const metricHeaders = selectedMetrics.map(metricId => metricLabels[metricId] || metricId);
        const finalHeaders = [...baseHeaders, ...metricHeaders, 'Creative Description'];

        // Add header row
        const dataWithHeaders = [
          finalHeaders,
          ...campaignData
        ];
        
        console.log('Exporting basic campaign data to existing spreadsheet');
        await googleSheetsService.appendSimpleData(spreadsheetId, dataWithHeaders);
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