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
      experimentalPercentage = 50
    } = options;
    
    try {
      // Load primer patterns (custom or default)
      let primerPatterns: PrimerPattern[];
      if (primerContent) {
        console.log('Using custom primer from uploaded file');
        primerPatterns = await primerService.loadCustomPrimer(primerContent);
      } else {
        console.log('Using default primer');
        primerPatterns = await primerService.loadDefaultPrimer();
      }

      // Group by confidence
      const grouped = primerService.groupByConfidence(primerPatterns);
      console.log(`Loaded primer: ${grouped.veryConfident.length} very confident, ${grouped.quiteConfident.length} quite confident, ${grouped.lowConfidence.length} low confidence patterns`);

      // Generate suggestions using OpenAI
      const targetWordCount = "40-46";
      const targetLanguage = this.getLanguageName(language);
      const isMultilingual = language !== 'en';
      console.log(`Targeting ${targetWordCount} words for maximum 14-15 second scripts in ${targetLanguage}`);
      console.log(`Experimentation level: ${experimentalPercentage}%`);

      // Build primer guidance sections
      const buildPrimerSection = (patterns: PrimerPattern[], confidenceLevel: string) => {
        if (patterns.length === 0) return '';
        
        return `
${confidenceLevel.toUpperCase()} PATTERNS (${confidenceLevel} confidence):
${patterns.map(p => `
- ${p.direction}: ${p.feature}
  Impact: ${p.percentageChange} change vs control
  Example: "${p.exampleSnippet}"
`).join('')}`;
      };

      const veryConfidentSection = buildPrimerSection(grouped.veryConfident, 'Very Confident');
      const quiteConfidentSection = buildPrimerSection(grouped.quiteConfident, 'Quite Confident');
      const lowConfidentSection = buildPrimerSection(grouped.lowConfidence, 'Low Confidence');

      const prompt = `
You are an expert copywriter specializing in What3Words app advertising voiceovers. Your task is to write voiceover scripts, guided by proven performance patterns from our Guidance Primer.

CONTEXT:
- What3Words assigns unique 3-word addresses to every 3x3 meter square globally
- These are voiceover scripts for video ads encouraging app downloads
- The background visuals are constant - you only write the spoken narration
- MANDATORY: Each script must be EXACTLY 40-46 words (maximum 14-15 seconds when spoken)

SCRIPT STRUCTURE REQUIREMENTS:
Write voice-only scripts with THREE parts:
1. OPENING: Start with an attention-grabbing or intriguing line
2. PRODUCT EXPLANATION: Briefly and clearly explain what three words
3. CLOSING CALL-TO-ACTION: End with a call to action that links back to the OPENING

IMPORTANT CONSTRAINTS:
- what three words does NOT give directions, only provides precise locations that people navigate to
- Never mention a rooftop as what3words doesn't work vertically
- A what three words location can only be written as "what three words address", "what three words location", "three word code", "three word address", or "three word identifier"
Use '3 meter square' if referring to area and never '3 meter squared or any other area measurement'
- Never mention or show any what three words address formatted as "///word.word.word"

${guidancePrompt ? `ADDITIONAL CREATIVE GUIDANCE:
Follow this thematic direction: "${guidancePrompt}"
Incorporate this guidance into your script creation while maintaining all other requirements.

` : ''}GUIDANCE PRIMER - PERFORMANCE PATTERNS:

Our Guidance Primer contains proven patterns from past campaign analysis, ranked by confidence level. Use these to inform your script creation:
${veryConfidentSection}
${quiteConfidentSection}
${lowConfidentSection}

HOW TO USE THE GUIDANCE PRIMER:

VERY CONFIDENT patterns: Follow these strongly - they have multi-test evidence and significant impact
QUITE CONFIDENT patterns: Incorporate these moderately - they show reliable results
LOW CONFIDENCE patterns: Use as light guidance only - allow flexibility and creative deviation

EXPERIMENTATION LEVEL: ${experimentalPercentage}%
- ${experimentalPercentage}% of scripts should be EXPERIMENTAL/CURVEBALL scripts that deviate from the primer
- ${100 - experimentalPercentage}% of scripts should FOLLOW the primer guidance closely
- Even experimental scripts should still avoid patterns marked "Avoid / soften" in Very Confident tier
- Experimental scripts can try novel approaches not covered in the primer

CREATIVE DIVERSITY REQUIREMENTS:
Create scripts with maximum variety:
${experimentalPercentage > 0 ? `
EXPERIMENTAL SCRIPTS (${experimentalPercentage}% of batch):
- Push creative boundaries with unusual angles, risky concepts, or surprising approaches
- Use unexpected metaphors, dramatic statements, or contrarian perspectives
- Experiment with different tones: mysterious, urgent, playful, philosophical, provocative
- Try unconventional structures not covered in the primer
- Explore creative edges that humans might not consider
` : ''}
${experimentalPercentage < 100 ? `
PRIMER-BASED SCRIPTS (${100 - experimentalPercentage}% of batch):
- Follow the primer guidance, especially Very Confident patterns
- Lean into patterns marked "Lean into"
- Avoid or soften patterns marked "Avoid / soften"
- Weight confidence levels appropriately (Very > Quite > Low)
` : ''}

TASK:
Write ${scriptCount} new voiceover scripts with maximum creative diversity:
- Vary tone, structure, opening style, and creative approach dramatically between scripts
- Are ONLY spoken narration (no visual descriptions)
- Must be EXACTLY 40-46 words (NEVER exceed 14-15 seconds when spoken naturally)
- Focus on encouraging What Three Words app downloads
- Always write "what three words" instead of "what3words" for proper voice pronunciation
- CRITICAL: Count every word carefully - scripts over 46 words will be rejected
- AVOID rewriting the same concept multiple times - surprise us with variety

${isMultilingual ? `CRITICAL LANGUAGE REQUIREMENT:
YOU MUST WRITE SCRIPTS NATIVELY IN ${targetLanguage.toUpperCase()} FIRST!
- DO NOT write in English and then translate
- Think and create DIRECTLY in ${targetLanguage} from the beginning
- The ${targetLanguage} script must be culturally authentic and natural-sounding
- Use native ${targetLanguage} expressions, idioms, and cultural references
- AFTER completing the ${targetLanguage} script, provide an accurate English translation
- Both versions must maintain the same creative intent and be 40-46 words
- The English translation should convey the meaning, not be word-for-word literal` : ''}

REFINEMENT CHECKLIST - Check each script and CORRECT if needed:
✓ The script does NOT mention or show any what three words address formatted as "///word.word.word"
✓ Each script has a distinctly different creative approach from the others
✓ Mix includes both primer-based and experimental scripts based on ${experimentalPercentage}% experimentation level
✓ Very Confident primer patterns are respected (especially "Avoid / soften" items)
✓ Total script is no more than 46 words
✓ The script would take no more than 14-15 seconds to say out loud at normal advertising pace
✓ what three words does not give directions, only provides precise locations that people navigate to
✓ A what three words location is only described as "what three words address", "what three words location", "three word code", "three word address", or "three word identifier"

For each voiceover script, provide:
1. TITLE: Brief concept description${isMultilingual ? ' (in English)' : ''}
2. CONTENT: The complete voiceover script ${isMultilingual ? `in ${targetLanguage}` : '(spoken words only)'}
${isMultilingual ? '3. ENGLISH_CONTENT: The English translation of the script' : ''}
${isMultilingual ? '4' : '3'}. REASONING: Explain which primer patterns you followed or deliberately deviated from, and why
${isMultilingual ? '5' : '4'}. TARGET METRICS: Which metrics this aims to improve (app_installs, save_location, search_3wa, directions, share)

Respond in JSON format:
{
  "suggestions": [
    {
      "title": "Voiceover concept name",
      "content": "${isMultilingual ? `Complete voiceover script in ${targetLanguage}` : 'Complete voiceover script - spoken words only (use \'what three words\' not \'what3words\')'}",
      ${isMultilingual ? '"englishContent": "English translation of the script (use \'what three words\' not \'what3words\')",' : ''}
      "reasoning": "Detailed explanation of primer patterns followed or deliberately deviated from", 
      "targetMetrics": ["app_installs", "save_location", "search_3wa"]
    }
  ]
}
`;

      const response = await openai.chat.completions.create({
        model: "o1",
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
      let suggestions: ScriptSuggestion[] = result.suggestions.map((suggestion: any) => {
        if (isMultilingual && suggestion.englishContent) {
          // For multilingual scripts, store the native language as content
          // and the English translation in a separate field (we'll use it for voice generation)
          return {
            ...suggestion,
            nativeContent: suggestion.content,  // Store the native language version
            content: suggestion.englishContent,  // Use English for voice generation
            language: language  // Store the language code
          };
        }
        return suggestion;
      });
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
        "Target Metrics",
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
