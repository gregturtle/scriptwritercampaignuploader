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
   * Read performance data from Google Sheets tab
   */
  async readPerformanceData(spreadsheetId: string, tabName: string = "Sheet1"): Promise<PerformanceData[]> {
    try {
      const cleanSpreadsheetId = googleSheetsService.extractSpreadsheetId(spreadsheetId);
      
      const response = await googleSheetsService.sheets.spreadsheets.values.get({
        spreadsheetId: cleanSpreadsheetId,
        range: `${tabName}!A:Z`, // Get all data from the tab
      });

      const rows = response.data.values || [];
      if (rows.length === 0) {
        throw new Error('No data found in the specified sheet tab');
      }

      // Skip header row and parse data
      const dataRows = rows.slice(1);
      const performanceData: PerformanceData[] = dataRows.map(row => ({
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
        score: row[12] ? parseFloat(row[12]) : undefined,
        scriptContent: row[13] || undefined, // Assuming script content is in column N
      }));

      return performanceData.filter(item => item.adId); // Filter out empty rows
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
    tabName: string = "Sheet1"
  ): Promise<ScriptSuggestion[]> {
    try {
      // Read the performance data
      const performanceData = await this.readPerformanceData(spreadsheetId, tabName);
      
      if (performanceData.length === 0) {
        throw new Error('No performance data available for analysis');
      }

      // Separate high and low performers based on scores
      const scoredData = performanceData.filter(item => item.score !== undefined);
      if (scoredData.length === 0) {
        throw new Error('No scored performance data found. Please ensure your cleansed data includes performance scores.');
      }

      // Sort by score and get top and bottom performers
      const sortedData = scoredData.sort((a, b) => (b.score || 0) - (a.score || 0));
      const topPerformers = sortedData.slice(0, Math.min(10, Math.ceil(sortedData.length * 0.3)));
      const bottomPerformers = sortedData.slice(-Math.min(10, Math.ceil(sortedData.length * 0.3)));

      // Prepare analysis for OpenAI
      const analysisData = {
        topPerformers: topPerformers.map(item => ({
          title: item.creativeTitle,
          script: item.scriptContent || 'Script content not available',
          score: item.score,
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
          script: item.scriptContent || 'Script content not available',
          score: item.score,
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
You are an expert marketing creative analyst specializing in app install campaigns. Analyze the performance data below and create 5 new video script suggestions that should perform exceptionally well.

TOP PERFORMING CREATIVES (High Scores):
${JSON.stringify(analysisData.topPerformers, null, 2)}

BOTTOM PERFORMING CREATIVES (Low Scores):
${JSON.stringify(analysisData.bottomPerformers, null, 2)}

Based on this data, identify:
1. What messaging, hooks, and creative elements work best
2. What patterns lead to high app installs, save location, directions, share, and search 3wa actions
3. What to avoid based on poor performers

Create 5 new video script suggestions that incorporate the best elements. Each script should be optimized for the metrics that matter most.

Respond with JSON in this exact format:
{
  "suggestions": [
    {
      "title": "Script title",
      "content": "Full video script with specific scenes, dialogue, and visual directions",
      "reasoning": "Why this script should perform well based on the data analysis",
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
    tabName: string = "AI Suggestions"
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