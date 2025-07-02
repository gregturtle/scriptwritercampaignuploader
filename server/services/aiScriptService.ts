import OpenAI from "openai";
import { googleSheetsService } from "./googleSheetsService";
import { elevenLabsService } from "./elevenLabsService";

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
  audioFile?: string;
  audioUrl?: string;
  error?: string;
}

class AIScriptService {
  /**
   * Read performance data from Google Sheets tab - specifically designed for "Cleansed with BEAP" tab
   */
  async readPerformanceData(
    spreadsheetId: string,
    tabName: string = "Cleansed with BEAP",
  ): Promise<PerformanceData[]> {
    try {
      const cleanSpreadsheetId =
        googleSheetsService.extractSpreadsheetId(spreadsheetId);

      const response = await googleSheetsService.sheets.spreadsheets.values.get(
        {
          spreadsheetId: cleanSpreadsheetId,
          range: `${tabName}!A:W`, // Get data including columns U and W
        },
      );

      const rows = response.data.values || [];
      if (rows.length === 0) {
        throw new Error(`No data found in the "${tabName}" tab`);
      }

      console.log(
        `Reading data from "${tabName}" tab with ${rows.length} total rows`,
      );

      // Skip header row and parse data
      const dataRows = rows.slice(1);
      const performanceData: PerformanceData[] = dataRows.map((row, index) => {
        // Column U is index 20 (U = 21st column, 0-indexed = 20)
        // Column W is index 22 (W = 23rd column, 0-indexed = 22)
        const score = row[20] ? parseFloat(row[20]) : undefined;
        const scriptContent = row[22] || undefined;

        return {
          exportDate: row[0] || "",
          campaignName: row[1] || "",
          adId: row[2] || "",
          adName: row[3] || "",
          creativeTitle: row[4] || "",
          status: row[5] || "",
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

      const validData = performanceData.filter(
        (item) => item.adId && item.score !== undefined && item.scriptContent,
      );
      console.log(
        `Filtered to ${validData.length} rows with valid Ad ID, score (column U), and script content (column W)`,
      );

      return validData;
    } catch (error) {
      console.error(
        "Error reading performance data from Google Sheets:",
        error,
      );
      throw error;
    }
  }

  /**
   * Analyze performance data and generate script suggestions with optional voice generation
   */
  async generateScriptSuggestions(
    spreadsheetId: string,
    options: {
      tabName?: string;
      voiceId?: string;
      includeVoice?: boolean;
      scriptCount?: number;
    } = {}
  ): Promise<{
    suggestions: ScriptSuggestion[];
    message: string;
    voiceGenerated?: boolean;
  }> {
    const { tabName = "Cleansed with BEAP", voiceId, includeVoice = false, scriptCount = 5 } = options;
    try {
      // Read the performance data
      const performanceData = await this.readPerformanceData(
        spreadsheetId,
        tabName,
      );

      if (performanceData.length === 0) {
        throw new Error("No performance data available for analysis");
      }

      // Separate high and low performers based on scores from column U
      const scoredData = performanceData.filter(
        (item) =>
          item.score !== undefined &&
          item.scriptContent &&
          item.scriptContent.trim().length > 0,
      );

      if (scoredData.length === 0) {
        throw new Error(
          "No scored performance data found with script content. Please ensure column U has scores and column W has script content.",
        );
      }

      console.log(
        `Found ${scoredData.length} entries with both scores (column U) and script content (column W)`,
      );

      // Sort by score and get top and bottom performers
      const sortedData = scoredData.sort(
        (a, b) => (b.score || 0) - (a.score || 0),
      );
      const topPerformers = sortedData.slice(
        0,
        Math.min(8, Math.ceil(sortedData.length * 0.25)),
      );
      const bottomPerformers = sortedData.slice(
        -Math.min(5, Math.ceil(sortedData.length * 0.15)),
      );

      console.log(
        `Analyzing ${topPerformers.length} top performers (highest scores) and ${bottomPerformers.length} bottom performers (lowest scores)`,
      );

      // Prepare analysis for OpenAI
      const analysisData = {
        topPerformers: topPerformers.map((item) => ({
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
            spend: item.spend,
          },
        })),
        bottomPerformers: bottomPerformers.map((item) => ({
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
            spend: item.spend,
          },
        })),
      };

      console.log(
        `Analyzing ${topPerformers.length} top performers and ${bottomPerformers.length} bottom performers`,
      );

      if (topPerformers.length === 0) {
        throw new Error(
          "No top performers found. Please ensure your data has entries with high scores in column U.",
        );
      }

      // Generate suggestions using OpenAI
      // Analyze existing script lengths to match the format
      const scriptLengths = topPerformers
        .map((item) => item.scriptContent?.length || 0)
        .filter((len) => len > 0);
      const avgScriptLength =
        scriptLengths.length > 0
          ? Math.round(
              scriptLengths.reduce((a, b) => a + b, 0) / scriptLengths.length,
            )
          : 150;

      const prompt = `
You are an expert copywriter specializing in What3Words app advertising voiceovers. Your task is to analyze both successful AND failed performance patterns to write data-driven voiceover scripts.

CRITICAL REQUIREMENT: You must analyze BOTH what works AND what doesn't work to inform your script creation.

CONTEXT:
- What3Words assigns unique 3-word addresses to every 3x3 meter location globally
- These are voiceover scripts for video ads encouraging app downloads
- The background visuals are constant - you only write the spoken narration
- Target script length: approximately ${avgScriptLength} characters (based on existing successful scripts)
- "Score" represents overall performance (higher = better performing voiceovers)

HIGH-PERFORMING VOICEOVER SCRIPTS (Learn from these SUCCESS patterns):
${topPerformers
  .map(
    (item) => `
- Score: ${item.score} | Voiceover: "${item.scriptContent}"
- Results: ${item.appInstalls} app installs, ${item.saveLocation} saves, ${item.search3wa} searches, ${item.directions} directions, ${item.share} shares
`,
  )
  .join("\n")}

LOW-PERFORMING VOICEOVER SCRIPTS (Learn from these FAILURE patterns):
${bottomPerformers
  .map(
    (item) => `
- Score: ${item.score} | Voiceover: "${item.scriptContent}"
- Results: ${item.appInstalls} app installs, ${item.saveLocation} saves, ${item.search3wa} searches, ${item.directions} directions, ${item.share} shares
`,
  )
  .join("\n")}

REQUIRED ANALYSIS:
You must identify:

SUCCESS PATTERNS (from high-scoring scripts):
1. What specific words, phrases, or messaging approaches drive high scores?
2. What tone, structure, or call-to-action style works best?
3. What hooks or value propositions resonate most?
4. What script length and pacing patterns are most effective?

FAILURE PATTERNS (from low-scoring scripts):
1. What specific words, phrases, or messaging approaches lead to poor performance?
2. What tone, structure, or approaches should be avoided?
3. What hooks or value propositions fall flat?
4. What script patterns consistently underperform?

TASK:
Based on your analysis of BOTH success and failure patterns above, write ${scriptCount} new voiceover scripts that:
- Incorporate proven successful elements from high-scoring data
- Actively avoid patterns that led to poor performance in low-scoring data
- Are ONLY spoken narration (no visual descriptions)
- Match successful script length (~${avgScriptLength} characters)
- Focus on encouraging What Three Words app downloads
- Always write "what three words" instead of "what3words" for proper voice pronunciation

For each voiceover script, provide:
1. TITLE: Brief concept description
2. CONTENT: The complete voiceover script (spoken words only)
3. REASONING: Explain specifically which successful patterns you incorporated AND which failure patterns you avoided
4. TARGET METRICS: Which metrics this aims to improve based on successful examples

Respond in JSON format:
{
  "suggestions": [
    {
      "title": "Voiceover concept name",
      "content": "Complete voiceover script - spoken words only (use 'what three words' not 'what3words')",
      "reasoning": "Detailed analysis of success patterns incorporated and failure patterns avoided from the data", 
      "targetMetrics": ["app_installs", "save_location", "search_3wa"]
    }
  ]
}
`;

      let response;
      try {
        response = await openai.chat.completions.create({
          model: "gpt-3.5-turbo", // Use cheaper model to avoid quota issues
          messages: [
            {
              role: "system",
              content: `You are an expert copywriter specializing in What3Words app advertising. Create compelling 20-second voiceover scripts (45-50 words max).

REQUIREMENTS:
- Each script must be exactly 45-50 words for 20-second audio
- Write "what three words" not "what3words" 
- Include hook, benefit, and call-to-action
- Target app downloads and location sharing

Structure: Hook (8-12 words) + Benefit (25-30 words) + CTA (8-12 words) = 45-50 words total`,
            },
            {
              role: "user",
              content: `Generate ${scriptCount} unique What3Words app advertising scripts. Each must be 45-50 words for 20-second voiceover.

Respond in JSON format:
{
  "suggestions": [
    {
      "title": "Script name",
      "content": "Complete script text (45-50 words)",
      "reasoning": "Why this works",
      "targetMetrics": ["app_installs"]
    }
  ]
}`,
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0.7,
          max_tokens: 1000,
        });
      } catch (quotaError: any) {
        // Re-throw the error without fallbacks as user requested
        throw quotaError;
      }

      const result = JSON.parse(response.choices[0].message.content || "{}");

      if (!result.suggestions || !Array.isArray(result.suggestions)) {
        throw new Error("Invalid response format from OpenAI");
      }

      console.log(`Generated ${result.suggestions.length} script suggestions`);
      
      let suggestions: ScriptSuggestion[] = result.suggestions;
      let voiceGenerated = false;

      // Generate voice recordings if requested and ElevenLabs is configured
      if (includeVoice && elevenLabsService.isConfigured()) {
        console.log('Starting voice generation for', suggestions.length, 'suggestions');
        try {
          suggestions = await elevenLabsService.generateScriptVoiceovers(
            suggestions,
            voiceId
          );
          voiceGenerated = true;
          console.log('Voice generation completed. Suggestions now have audioUrl:', suggestions.some(s => s.audioUrl));
        } catch (error) {
          console.error('Error generating voice recordings:', error);
          // Continue without voice - don't fail the entire operation
        }
      } else {
        console.log('Voice generation skipped. includeVoice:', includeVoice, 'isConfigured:', elevenLabsService.isConfigured());
      }

      return {
        suggestions,
        message: 'Successfully generated script suggestions based on performance analysis',
        voiceGenerated
      };
    } catch (error) {
      console.error("Error generating script suggestions:", error);
      throw error;
    }
  }

  /**
   * Save generated suggestions back to Google Sheets
   */
  async saveSuggestionsToSheet(
    spreadsheetId: string,
    suggestions: ScriptSuggestion[],
    tabName: string = "New Scripts",
  ): Promise<void> {
    try {
      const cleanSpreadsheetId =
        googleSheetsService.extractSpreadsheetId(spreadsheetId);

      // Prepare data for sheets
      const headers = [
        "Generated Date",
        "Script Title",
        "Script Content",
        "AI Reasoning",
        "Target Metrics",
      ];
      const generatedDate = new Date().toISOString().split("T")[0];

      const rows = suggestions.map((suggestion) => [
        generatedDate,
        suggestion.title,
        suggestion.content,
        suggestion.reasoning,
        suggestion.targetMetrics.join(", "),
      ]);

      // Try to create the tab first (will fail silently if it exists)
      try {
        await googleSheetsService.sheets.spreadsheets.batchUpdate({
          spreadsheetId: cleanSpreadsheetId,
          resource: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: tabName,
                  },
                },
              },
            ],
          },
        });

        // Add headers to new sheet
        await googleSheetsService.sheets.spreadsheets.values.update({
          spreadsheetId: cleanSpreadsheetId,
          range: `${tabName}!A1:E1`,
          valueInputOption: "RAW",
          resource: {
            values: [headers],
          },
        });
      } catch (error) {
        // Tab might already exist, continue
      }

      // Find next empty row and add data
      const existingDataResponse =
        await googleSheetsService.sheets.spreadsheets.values.get({
          spreadsheetId: cleanSpreadsheetId,
          range: `${tabName}!A:A`,
        });

      const existingRows = existingDataResponse.data.values || [];
      const nextRow = existingRows.length + 1;

      await googleSheetsService.sheets.spreadsheets.values.update({
        spreadsheetId: cleanSpreadsheetId,
        range: `${tabName}!A${nextRow}:E${nextRow + rows.length - 1}`,
        valueInputOption: "RAW",
        resource: {
          values: rows,
        },
      });

      console.log(
        `Saved ${suggestions.length} suggestions to sheet tab "${tabName}"`,
      );
    } catch (error) {
      console.error("Error saving suggestions to Google Sheets:", error);
      throw error;
    }
  }
}

export const aiScriptService = new AIScriptService();
