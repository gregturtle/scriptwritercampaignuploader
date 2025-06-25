import OpenAI from "openai";
import { googleSheetsService } from "./googleSheetsService";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface PerformanceData {
  exportDate: string;
  campaignName: string;
  adId: string;
  adName: string;
  creativeTitle: string;
  status: string;
  spend: number;
  appInstalls: number;
  saveLocation: number;
  directions: number;
  share: number;
  search3wa: number;
  score?: number;
  scriptContent?: string;
}

interface ScriptSuggestion {
  title: string;
  content: string;
  reasoning: string;
  targetMetrics: string[];
}

class AIScriptService {
  /**
   * Read performance data from Google Sheets tab - specifically designed for "Cleansed with BEAP" tab
   */
  async readPerformanceData(spreadsheetId: string, tabName: string = "Cleansed with BEAP"): Promise<PerformanceData[]> {
    try {
      const cleanSpreadsheetId = googleSheetsService.extractSpreadsheetId(spreadsheetId);
      
      const response = await googleSheetsService.sheets.spreadsheets.values.get({
        spreadsheetId: cleanSpreadsheetId,
        range: `${tabName}!A:W`, // Get data including columns U and W
      });

      const rows = response.data.values || [];
      if (rows.length === 0) {
        throw new Error(`No data found in the "${tabName}" tab`);
      }

      console.log(`Reading data from "${tabName}" tab with ${rows.length} total rows`);

      // Skip header row and parse data
      const dataRows = rows.slice(1);
      const performanceData: PerformanceData[] = dataRows.map((row, index) => {
        // Column U is index 20 (U = 21st column, 0-indexed = 20)
        // Column W is index 22 (W = 23rd column, 0-indexed = 22)
        const score = row[20] ? parseFloat(row[20]) : undefined;
        const scriptContent = row[22] || undefined;
        
        return {
          exportDate: row[0] || '',
          campaignName: row[1] || '',
          adId: row[2] || '',
          adName: row[3] || '',
          creativeTitle: row[4] || '',
          status: row[5] || '',
          spend: parseFloat(row[6]) || 0,
          appInstalls: parseInt(row[7]) || 0,
          saveLocation: parseInt(row[8]) || 0,
          directions: parseInt(row[9]) || 0,
          share: parseInt(row[10]) || 0,
          search3wa: parseInt(row[11]) || 0,
          score: score, // Column U (index 20)
          scriptContent: scriptContent, // Column W (index 22)
        };
      });

      const validData = performanceData.filter(item => item.adId && item.score !== undefined && item.scriptContent);
      console.log(`Filtered to ${validData.length} rows with valid Ad ID, score (column U), and script content (column W)`);
      
      return validData;
    } catch (error) {
      console.error('Error reading performance data from Google Sheets:', error);
      throw error;
    }
  }

  /**
   * Analyze performance data and generate script suggestions
   */
  async generateScriptSuggestions(
    spreadsheetId: string, 
    tabName: string = "Cleansed with BEAP"
  ): Promise<ScriptSuggestion[]> {
    try {
      // Read the performance data
      const performanceData = await this.readPerformanceData(spreadsheetId, tabName);
      
      if (performanceData.length === 0) {
        throw new Error('No performance data available for analysis');
      }

      // Separate high and low performers based on scores from column U
      const scoredData = performanceData.filter(item => 
        item.score !== undefined && 
        item.scriptContent && 
        item.scriptContent.trim().length > 0
      );
      
      if (scoredData.length === 0) {
        throw new Error('No scored performance data found with script content. Please ensure column U has scores and column W has script content.');
      }

      console.log(`Found ${scoredData.length} entries with both scores (column U) and script content (column W)`);

      // Sort by score and get top and bottom performers
      const sortedData = scoredData.sort((a, b) => (b.score || 0) - (a.score || 0));
      const topPerformers = sortedData.slice(0, Math.min(8, Math.ceil(sortedData.length * 0.25)));
      const bottomPerformers = sortedData.slice(-Math.min(5, Math.ceil(sortedData.length * 0.15)));

      console.log(`Analyzing ${topPerformers.length} top performers (highest scores) and ${bottomPerformers.length} bottom performers (lowest scores)`);

      // Prepare analysis for OpenAI
      const analysisData = {
        topPerformers: topPerformers.map(item => ({
          title: item.creativeTitle,
          script: item.scriptContent, // From column W
          score: item.score, // From column U
          adId: item.adId,
          metrics: {
            appInstalls: item.appInstalls,
            saveLocation: item.saveLocation,
            directions: item.directions,
            share: item.share,
            search3wa: item.search3wa,
            spend: item.spend
          }
        })),
        bottomPerformers: bottomPerformers.map(item => ({
          title: item.creativeTitle,
          script: item.scriptContent, // From column W
          score: item.score, // From column U
          adId: item.adId,
          metrics: {
            appInstalls: item.appInstalls,
            saveLocation: item.saveLocation,
            directions: item.directions,
            share: item.share,
            search3wa: item.search3wa,
            spend: item.spend
          }
        }))
      };

      console.log(`Analyzing ${topPerformers.length} top performers and ${bottomPerformers.length} bottom performers`);

      // Generate suggestions using OpenAI
      const prompt = `
You are an expert marketing creative analyst specializing in What3Words app campaigns. These are ads specifically for the What3Words mobile app - a location technology that has divided the world into 3m x 3m squares, each identified by a unique combination of three words.

CAMPAIGN CONTEXT:
- All ads are for the What3Words app (iOS/Android)
- The app helps users find, share, and navigate to precise locations using three words
- Primary use cases: navigation, delivery, emergency services, social sharing of locations

PERFORMANCE DATA ANALYSIS:
- Usage Score (Column U): A comprehensive performance metric that combines several features. Higher scores = better performing scripts
- Script Content (Column W): The actual creative copy that was used in these video ads
- Metrics tracked: app installs, save location actions, directions requests, shares, and search 3wa actions

TOP PERFORMING CREATIVES (Highest Usage Scores):
${JSON.stringify(analysisData.topPerformers, null, 2)}

BOTTOM PERFORMING CREATIVES (Lowest Usage Scores):
${JSON.stringify(analysisData.bottomPerformers, null, 2)}

ANALYSIS REQUIREMENTS:
1. Identify what messaging, hooks, and creative elements in HIGH USAGE SCORE scripts drive performance
2. Determine what script patterns lead to high app installs, location saves, direction requests, shares, and 3-word address searches
3. Identify what to avoid based on LOW USAGE SCORE script patterns
4. Focus on What3Words app benefits: precise location sharing, easy navigation, memorable addresses

CREATE 5 NEW WHAT3WORDS VIDEO SCRIPTS:
Generate scripts that incorporate the best elements from high-scoring performers while avoiding patterns from low-scoring ones. Each script should demonstrate What3Words app functionality and drive the target user actions.

Respond with JSON in this exact format:
{
  "suggestions": [
    {
      "title": "Compelling script title for What3Words ad",
      "content": "Complete video script with scenes, dialogue, visual directions, and What3Words app demonstration",
      "reasoning": "Detailed explanation based on analysis of high vs low usage score patterns from the data",
      "targetMetrics": ["app_install", "save_location", "directions", "share", "search_3wa"]
    }
  ]
}
`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert marketing creative analyst who excels at identifying winning creative patterns and generating high-performing video scripts."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      if (!result.suggestions || !Array.isArray(result.suggestions)) {
        throw new Error('Invalid response format from OpenAI');
      }

      console.log(`Generated ${result.suggestions.length} script suggestions`);
      return result.suggestions;

    } catch (error) {
      console.error('Error generating script suggestions:', error);
      throw error;
    }
  }

  /**
   * Save generated suggestions back to Google Sheets
   */
  async saveSuggestionsToSheet(
    spreadsheetId: string, 
    suggestions: ScriptSuggestion[],
    tabName: string = "New Scripts"
  ): Promise<void> {
    try {
      const cleanSpreadsheetId = googleSheetsService.extractSpreadsheetId(spreadsheetId);
      
      // Prepare data for sheets
      const headers = ['Generated Date', 'Script Title', 'Script Content', 'AI Reasoning', 'Target Metrics'];
      const generatedDate = new Date().toISOString().split('T')[0];
      
      const rows = suggestions.map(suggestion => [
        generatedDate,
        suggestion.title,
        suggestion.content,
        suggestion.reasoning,
        suggestion.targetMetrics.join(', ')
      ]);

      // Try to create the tab first (will fail silently if it exists)
      try {
        await googleSheetsService.sheets.spreadsheets.batchUpdate({
          spreadsheetId: cleanSpreadsheetId,
          resource: {
            requests: [{
              addSheet: {
                properties: {
                  title: tabName
                }
              }
            }]
          }
        });
        
        // Add headers to new sheet
        await googleSheetsService.sheets.spreadsheets.values.update({
          spreadsheetId: cleanSpreadsheetId,
          range: `${tabName}!A1:E1`,
          valueInputOption: 'RAW',
          resource: {
            values: [headers]
          }
        });
        
      } catch (error) {
        // Tab might already exist, continue
      }

      // Find next empty row and add data
      const existingDataResponse = await googleSheetsService.sheets.spreadsheets.values.get({
        spreadsheetId: cleanSpreadsheetId,
        range: `${tabName}!A:A`,
      });
      
      const existingRows = existingDataResponse.data.values || [];
      const nextRow = existingRows.length + 1;

      await googleSheetsService.sheets.spreadsheets.values.update({
        spreadsheetId: cleanSpreadsheetId,
        range: `${tabName}!A${nextRow}:E${nextRow + rows.length - 1}`,
        valueInputOption: 'RAW',
        resource: {
          values: rows
        }
      });

      console.log(`Saved ${suggestions.length} suggestions to sheet tab "${tabName}"`);
    } catch (error) {
      console.error('Error saving suggestions to Google Sheets:', error);
      throw error;
    }
  }
}

export const aiScriptService = new AIScriptService();