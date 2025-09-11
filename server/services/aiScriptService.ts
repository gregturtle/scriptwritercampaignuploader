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
  fileName?: string;
  videoFile?: string;
  videoUrl?: string;
  videoFileId?: string;
  videoError?: string;
  folderLink?: string;
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

      const rows = await googleSheetsService.readTabData(cleanSpreadsheetId, tabName, "A:W");
      if (rows.length === 0) {
        throw new Error(`No data found in the "${tabName}" tab`);
      }

      console.log(
        `Reading data from "${tabName}" tab with ${rows.length} total rows`,
      );

      // Skip header row and parse data
      const dataRows = rows.slice(1);
      const performanceData: PerformanceData[] = dataRows.map((row: any, index: number) => {
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
      guidancePrompt?: string;
    } = {}
  ): Promise<{
    suggestions: ScriptSuggestion[];
    message: string;
    voiceGenerated?: boolean;
  }> {
    const { tabName = "Cleansed with BEAP", voiceId, includeVoice = false, scriptCount = 5, guidancePrompt } = options;
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
      // Force 40-46 word scripts for maximum 14-15 seconds
      const targetWordCount = "40-46";
      console.log(`Targeting ${targetWordCount} words for maximum 14-15 second scripts`);

      const prompt = `
You are an expert copywriter specializing in What3Words app advertising voiceovers. Your task is to analyze both successful AND failed performance patterns to write data-driven voiceover scripts.

CRITICAL REQUIREMENT: You must analyze BOTH what works AND what doesn't work to inform your script creation.

CONTEXT:
- What3Words assigns unique 3-word addresses to every 3x3 meter location globally
- These are voiceover scripts for video ads encouraging app downloads
- The background visuals are constant - you only write the spoken narration
- MANDATORY: Each script must be EXACTLY 40-46 words (maximum 14-15 seconds when spoken)
- "Score" represents overall performance (higher = better performing voiceovers)

SCRIPT STRUCTURE REQUIREMENTS:
Write voice-only scripts with THREE parts:
1. OPENING: Start with an attention-grabbing or intriguing line
2. PRODUCT EXPLANATION: Briefly and clearly explain what three words
3. CLOSING CALL-TO-ACTION: End with a call to action that links back to the OPENING

STYLE & TONE GUIDELINES:
- Use confident, normal language
- Keep the script universally appealing (audience flexible)
- Add creative or random elements to ensure novelty and interest
- Write for Meta platforms (Facebook/Instagram)

IMPORTANT CONSTRAINTS:
- what three words does NOT give directions, only provides precise locations that people navigate to
- A what three words location can only be written as "what three words address", "what three words location", "three word code", "three word address", or "three word identifier"
- Never mention or show any what three words address formatted as "///word.word.word"

${guidancePrompt ? `ADDITIONAL CREATIVE GUIDANCE:
Follow this thematic direction: "${guidancePrompt}"
Incorporate this guidance into your script creation while maintaining all other requirements.

` : ''}HIGH-PERFORMING VOICEOVER SCRIPTS (Learn from these SUCCESS patterns):
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

CREATIVE DIVERSITY REQUIREMENTS:
Create a mix of scripts with distinct creative approaches:

CONVENTIONAL SCRIPTS (50% of batch):
- Use proven successful patterns from high-scoring data
- Safe, obvious messaging that clearly explains the value
- Professional, straightforward tone
- Clear benefit-focused structure

BOLD EXPERIMENTAL SCRIPTS (50% of batch):
- Push creative boundaries with unusual angles, risky concepts, or surprising approaches
- Use unexpected metaphors, dramatic statements, or contrarian perspectives
- Experiment with different tones: mysterious, urgent, playful, philosophical, provocative
- Try unconventional structures: questions-only, countdown style, story fragments, contradictions
- Explore creative edges that humans might not consider, even if performance is uncertain

TASK:
Write ${scriptCount} new voiceover scripts with maximum creative diversity:
- Include roughly 50% conventional safe scripts and 50% bold experimental scripts
- Vary tone, structure, opening style, and creative approach dramatically between scripts
- Are ONLY spoken narration (no visual descriptions)
- Must be EXACTLY 40-46 words (NEVER exceed 14-15 seconds when spoken naturally)
- Focus on encouraging What Three Words app downloads
- Always write "what three words" instead of "what3words" for proper voice pronunciation
- CRITICAL: Count every word carefully - scripts over 46 words will be rejected
- AVOID rewriting the same concept multiple times - surprise us with variety

CREATIVE INSPIRATION:
- What if the script started with a contradiction or paradox?
- What if it used reverse psychology or challenged assumptions?
- What if it told a micro-story or created intrigue?
- What if it used unexpected comparisons or metaphors?
- What if it addressed fears, desires, or hidden motivations?
- What if it broke conventional advertising rules?

REFINEMENT CHECKLIST - Check each script and CORRECT if needed:
✓ The script does NOT mention or show any what three words address formatted as "///word.word.word"
✓ Each script has a distinctly different creative approach from the others
✓ Roughly half are conventional, half are bold/experimental
✓ The product explanation is present but may be unconventional in experimental scripts
✓ Tone varies significantly between scripts
✓ Total script is no more than 46 words
✓ The script would take no more than 14-15 seconds to say out loud at normal advertising pace
✓ what three words does not give directions, only provides precise locations that people navigate to
✓ A what three words location is only described as "what three words address", "what three words location", "three word code", "three word address", or "three word identifier"

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

      const response = await openai.chat.completions.create({
        model: "gpt-4.1-2025-04-14",
        messages: [
          {
            role: "system",
            content:
              "You are a bold creative director and experimental copywriter who combines data-driven insights with fearless creative exploration. You excel at creating surprising, diverse advertising concepts that range from safe and proven to wildly experimental and boundary-pushing. Your goal is maximum creative variety - never repeat the same approach twice.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.9,
      });

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

      // Create timestamped tab name
      const now = new Date();
      const timestamp = now.toLocaleString('en-CA', { 
        timeZone: 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).replace(',', '');
      const timestampedTabName = `${tabName} ${timestamp}`;

      // Prepare data for sheets
      const headers = [
        "Generated Date",
        "File Title", 
        "Script Title",
        "Script Content",
        "AI Reasoning",
        "Target Metrics",
      ];
      const generatedDate = new Date().toISOString().split("T")[0];

      const rows = suggestions.map((suggestion, index) => {
        // Generate file title with script numbering and safe formatting
        const safeTitle = suggestion.title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').substring(0, 40);
        const fileTitle = `script${index + 1}_${safeTitle}_${Date.now()}`;
        
        return [
          generatedDate,
          fileTitle,
          suggestion.title,
          suggestion.content,
          suggestion.reasoning,
          suggestion.targetMetrics.join(", "),
        ];
      });

      // Create the tab and add headers
      await googleSheetsService.createTab(cleanSpreadsheetId, timestampedTabName, headers);

      // Add data to the tab
      await googleSheetsService.appendDataToTab(cleanSpreadsheetId, timestampedTabName, rows);

      console.log(
        `Saved ${suggestions.length} suggestions to sheet tab "${timestampedTabName}"`,
      );
    } catch (error) {
      console.error("Error saving suggestions to Google Sheets:", error);
      throw error;
    }
  }
}

export const aiScriptService = new AIScriptService();
