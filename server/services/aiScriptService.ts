import OpenAI from "openai";
import { googleSheetsService } from "./googleSheetsService";
import { elevenLabsService } from "./elevenLabsService";
import { primerService, PrimerPattern } from "./primerService";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface ScriptSuggestion {
  title: string;
  content: string;
  nativeContent?: string;  // Native language version when multilingual
  englishContent?: string; // English translation when multilingual
  language?: string;       // Language code when multilingual
  reasoning: string;
  targetMetrics?: string[];
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
   * Map language codes to their full names
   */
  private getLanguageName(code: string): string {
    const languageNames: { [key: string]: string } = {
      'en': 'English',
      'es': 'Spanish', 
      'fr': 'French',
      'de': 'German',
      'it': 'Italian',
      'pt': 'Portuguese',
      'ru': 'Russian',
      'zh': 'Chinese',
      'ja': 'Japanese',
      'ko': 'Korean',
      'ar': 'Arabic',
      'hi': 'Hindi',
      'nl': 'Dutch',
      'pl': 'Polish',
      'tr': 'Turkish',
      'sv': 'Swedish',
      'no': 'Norwegian',
      'da': 'Danish',
      'fi': 'Finnish',
      'he': 'Hebrew',
      'el': 'Greek',
      'cs': 'Czech',
      'hu': 'Hungarian',
      'ro': 'Romanian',
      'th': 'Thai',
      'vi': 'Vietnamese',
      'id': 'Indonesian',
      'ms': 'Malay',
      'uk': 'Ukrainian',
      'bn': 'Bengali',
      'ta': 'Tamil',
      'te': 'Telugu',
      'mr': 'Marathi',
      'gu': 'Gujarati',
      'ur': 'Urdu',
      'pa': 'Punjabi'
    };
    return languageNames[code] || code.toUpperCase();
  }

  /**
   * Generate script suggestions using guidance primer
   */
  async generateScriptSuggestions(
    spreadsheetId: string,
    options: {
      voiceId?: string;
      includeVoice?: boolean;
      scriptCount?: number;
      guidancePrompt?: string;
      language?: string;
      primerContent?: string;
      experimentalPercentage?: number;
      individualGeneration?: boolean;
    } = {}
  ): Promise<{
    suggestions: ScriptSuggestion[];
    message: string;
    voiceGenerated?: boolean;
  }> {
    const { 
      voiceId, 
      includeVoice = false, 
      scriptCount = 5, 
      guidancePrompt, 
      language = 'en',
      primerContent,
      experimentalPercentage = 50,
      individualGeneration = false
    } = options;
    
    try {
      // Load raw CSV content for the primer
      const primerCSVContent = await primerService.loadPrimerCSVContent(primerContent);
      console.log('Loaded primer CSV content');
      
      // Generate suggestions using OpenAI
      const targetLanguage = this.getLanguageName(language);
      const isMultilingual = language !== 'en';
      console.log(`Experimentation level: ${experimentalPercentage}%`);

      // Build the creative inspiration section
      const creativeInspirationSection = guidancePrompt ? guidancePrompt.trim() : '';

      const prompt = `# OBJECTIVE
You are a copywriter specialising in advertising voiceovers for video ads to run on Meta social platforms, goal of the user downloading the what3words app and then going on to do a key what3words metric action. The background visuals are constant - you only write the spoken narration. Your task is to write voiceover scripts, guided by proven performance patterns from our 'Guidance Primer'. 

## SCRIPT STRUCTURE:
Write voice-only scripts with three parts:
- OPENING: Start with an attention-grabbing or intriguing line
- PRODUCT EXPLANATION: Briefly and clearly explain what three words
- CLOSING CALL-TO-ACTION: End with a call to action, with an optional nod to the opening line.

## CONSTRAINTS:
- Never mention a rooftop or similar, as what3words doesn't work vertically

- A what three words location can only be written as "what three words address", "what three words location", "three word code", "three word address", or "three word identifier"

- Use '3 meter square' if referring to area and never '3 meter squared' or any other area measurement

- Never mention or show any specific or example what3words address itself

## ADDITIONAL CREATIVE INSPIRATION:
${creativeInspirationSection}
${creativeInspirationSection ? 'Incorporate this guidance into your script creation too.' : ''}

# PRIMER

## GUIDANCE PRIMER – PERFORMANCE PATTERNS CSV:
${primerCSVContent}

## Proportion of Scripts to follow or deviate from primer guidance: 
### ${experimentalPercentage}% of scripts should be EXPERIMENTAL/CURVEBALL scripts that can deviate from the primer, trying novel approaches that might not be covered in the primer, for example:
- Push creative boundaries with unusual angles, concepts, or approaches
- Use unexpected metaphors, statements, perspectives
- Experiment with different tones: mysterious, urgent, playful, philosophical, provocative etc (not an exhaustive list, can use your own judgement)
- Try unconventional structures not covered in the primer
- Explore creative edges that humans might not consider

### ${100 - experimentalPercentage}% of scripts should FOLLOW the primer guidance closely
- Use the data provided as to which themes help or hinder performance to try to create winning scripts.

# TASK:
Write ${scriptCount} new voiceover script with maximum creative diversity:
- Vary tone, structure, opening style, and creative approach dramatically between scripts
- Are only spoken narration (no visual descriptions)
- Must be exactly 40–46 words (never exceed 14–15 seconds when spoken naturally)
- Always write "what three words" instead of "what3words" for proper voice pronunciation
- Scripts over 46 words will be rejected

# OUTPUT FORMAT:
Respond in JSON format:
{
  "suggestions": [
    {
      "title": "Voiceover concept name",
      "content": "Complete voiceover script - spoken words only)",
      "reasoning": "Detailed explanation of primer patterns followed or deliberately deviated from"
    }
  ]
}
`;

      let suggestions: ScriptSuggestion[] = [];

      if (individualGeneration) {
        // Individual generation mode: Make concurrent API calls, 5 scripts per call
        const scriptsPerCall = 5;
        const numCalls = Math.ceil(scriptCount / scriptsPerCall);
        console.log(`Individual generation mode: Making ${numCalls} concurrent API calls (${scriptsPerCall} scripts per call)`);
        
        // Modify prompt to request exactly 5 scripts
        const individualPrompt = prompt.replace(`Write ${scriptCount} new voiceover scripts`, `Write ${scriptsPerCall} new voiceover scripts`);
        
        // Create array of promises for concurrent execution
        const apiCalls = Array.from({ length: numCalls }, (_, callIndex) => 
          openai.chat.completions.create({
            model: "gpt-5",
            messages: [
              {
                role: "user",
                content: isMultilingual 
                  ? `You are a multilingual creative director and experimental copywriter fluent in ${targetLanguage}. You think and create NATIVELY in ${targetLanguage}, not through translation. \n\n${individualPrompt}`
                  : `\n\n${individualPrompt}`,
              },
            ],
            response_format: { type: "json_object" },
            reasoning_effort: "high",
          }).then(response => {
            const result = JSON.parse(response.choices[0].message.content || "{}");
            
            if (!result.suggestions || !Array.isArray(result.suggestions)) {
              console.warn(`Invalid or empty response for API call ${callIndex + 1}`);
              return [];
            }

            // Process all scripts from this call
            return result.suggestions.map((suggestion: any) => {
              if (isMultilingual && suggestion.englishContent) {
                return {
                  ...suggestion,
                  nativeContent: suggestion.content,
                  content: suggestion.englishContent,
                  language: language
                };
              }
              return suggestion;
            });
          }).catch(error => {
            console.error(`Error in API call ${callIndex + 1}:`, error);
            return [];
          })
        );
        
        // Wait for all API calls to complete
        const results = await Promise.all(apiCalls);
        
        // Flatten the array of arrays and take only the requested number of scripts
        suggestions = results.flat().slice(0, scriptCount);
        
        console.log(`Individual generation complete: ${suggestions.length} scripts generated concurrently from ${numCalls} calls`);
      } else {
        // Batch generation mode: Single API call requesting all scripts
        console.log(`Batch generation mode: Making 1 API call for ${scriptCount} scripts`);
        
        const response = await openai.chat.completions.create({
          model: "gpt-5",
          messages: [
            {
              role: "user",
              content: isMultilingual 
                ? `You are a multilingual creative director and experimental copywriter fluent in ${targetLanguage}. You think and create NATIVELY in ${targetLanguage}, not through translation. You use data-driven insights from the Guidance Primer while maintaining creative flexibility. Your scripts range from primer-based to experimental based on the specified experimentation level. Maximum creative variety - never repeat the same approach twice. CRITICAL: Always write scripts DIRECTLY in ${targetLanguage} first, thinking in that language's cultural context, then provide English translations.\n\n${prompt}`
                : `You are a creative director and experimental copywriter who uses data-driven insights from the Guidance Primer while maintaining creative flexibility. You excel at balancing proven patterns with experimental approaches based on the specified experimentation level. Your goal is maximum creative variety - never repeat the same approach twice.\n\n${prompt}`,
            },
          ],
          response_format: { type: "json_object" },
          reasoning_effort: "high",
        });

        const result = JSON.parse(response.choices[0].message.content || "{}");

        if (!result.suggestions || !Array.isArray(result.suggestions)) {
          throw new Error("Invalid response format from OpenAI");
        }

        console.log(`Generated ${result.suggestions.length} script suggestions in ${targetLanguage}`);
        
        // Process multilingual responses
        suggestions = result.suggestions.map((suggestion: any) => {
          if (isMultilingual && suggestion.englishContent) {
            return {
              ...suggestion,
              nativeContent: suggestion.content,
              content: suggestion.englishContent,
              language: language
            };
          }
          return suggestion;
        });
      }
      let voiceGenerated = false;

      // Generate voice recordings if requested and ElevenLabs is configured
      if (includeVoice && elevenLabsService.isConfigured()) {
        console.log('Starting voice generation for', suggestions.length, 'suggestions');
        try {
          // Pass language information for multilingual voice generation
          suggestions = await elevenLabsService.generateScriptVoiceovers(
            suggestions,
            voiceId,
            language // Pass the language code for proper voice selection
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
        message: 'Successfully generated script suggestions using Guidance Primer',
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
        "Recording Language",
        "Native Language Script",
        "English Script",
        "AI Reasoning",
      ];
      const generatedDate = new Date().toISOString().split("T")[0];

      const rows = suggestions.map((suggestion, index) => {
        // Generate file title with script numbering and safe formatting
        const safeTitle = suggestion.title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').substring(0, 40);
        const fileTitle = `script${index + 1}_${safeTitle}_${Date.now()}`;
        
        // Get language name from code
        const languageName = suggestion.language ? this.getLanguageName(suggestion.language) : 'English';
        
        return [
          generatedDate,
          fileTitle,
          suggestion.title,
          languageName, // Recording Language
          suggestion.nativeContent || suggestion.content, // Native Language Script (or English if not multilingual)
          suggestion.content, // English Script (always the English version or translation)
          suggestion.reasoning,
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
