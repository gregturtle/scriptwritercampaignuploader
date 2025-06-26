import express, { Request } from "express";
import { createServer, type Server } from "http";
import { storage as appStorage } from "./storage";
import multer from "multer";
import path from "path";
import fs from "fs";
import { z } from "zod";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { 
  insertFileSchema, 
  insertActivityLogSchema, 
  insertCampaignSchema,
  insertCreativeSchema
} from "@shared/schema";
import { metaApiService } from "./services/metaApi";
import { fileService } from "./services/fileService";
import { performanceReportService } from "./services/performanceReportService";
import { aiScriptService } from "./services/aiScriptService";
import { elevenLabsService } from "./services/elevenLabsService";

// Helper function to get access token
async function getAccessToken(): Promise<string> {
  const token = await appStorage.getLatestAuthToken();
  
  if (!token) {
    throw new Error("Not authenticated");
  }
  
  // Check if token is expired
  if (new Date(token.expiresAt) <= new Date()) {
    throw new Error("Token expired, please login again");
  }
  
  return token.accessToken;
}

// Setup file upload middleware
const uploadDir = path.join(process.cwd(), "uploads");
// Create uploads directory if it doesn't exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const diskStorage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, uploadDir);
  },
  filename: function (_req, file, cb) {
    // Create unique filename
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({
  storage: diskStorage,
  fileFilter: (_req, file, cb) => {
    // Only accept .mov files
    if (file.originalname.endsWith(".mov")) {
      cb(null, true);
    } else {
      cb(new Error("Only .mov files are allowed"));
    }
  },
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
});

export async function registerRoutes(app: express.Express): Promise<Server> {
  
  // AI Script Generation endpoints - MUST be first to avoid static file conflicts
  app.post('/api/ai/generate-scripts', async (req, res) => {
    try {
      console.log('AI script generation request received:', req.body);
      const { spreadsheetId, tabName } = req.body;
      
      if (!spreadsheetId) {
        return res.status(400).json({ message: 'Spreadsheet ID is required' });
      }

      console.log(`Generating AI script suggestions from sheet: ${spreadsheetId}, tab: ${tabName || 'Cleansed with BEAP'}`);
      
      const result = await aiScriptService.generateScriptSuggestions(
        spreadsheetId, 
        {
          tabName: tabName || 'Cleansed with BEAP',
          includeVoice: true
        }
      );

      console.log(`Generated ${result.suggestions.length} suggestions`);

      // Save suggestions to "New Scripts" tab
      await aiScriptService.saveSuggestionsToSheet(spreadsheetId, result.suggestions, "New Scripts");

      res.json({
        suggestions: result.suggestions,
        message: `Generated ${result.suggestions.length} script suggestions based on performance data analysis`,
        savedToSheet: true,
        voiceGenerated: result.voiceGenerated
      });
    } catch (error) {
      console.error('Error generating AI script suggestions:', error);
      
      res.status(500).json({ 
        message: 'Failed to generate script suggestions', 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get('/api/ai/performance-data/:spreadsheetId', async (req, res) => {
    try {
      const { spreadsheetId } = req.params;
      const { tabName } = req.query;
      
      const performanceData = await aiScriptService.readPerformanceData(
        spreadsheetId, 
        tabName as string || 'Cleansed with BEAP'
      );
      
      res.json({
        data: performanceData,
        count: performanceData.length,
        scoredCount: performanceData.filter(item => item.score !== undefined).length
      });
    } catch (error) {
      console.error('Error reading performance data:', error);
      res.status(500).json({ 
        message: 'Failed to read performance data', 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  // Auth routes
  app.get("/api/auth/status", async (req, res) => {
    try {
      const token = await appStorage.getLatestAuthToken();
      const isAuthenticated = !!token && new Date(token.expiresAt) > new Date();
      
      res.json({ authenticated: isAuthenticated });
    } catch (error) {
      console.error("Error checking auth status:", error);
      res.status(500).json({ message: "Failed to check authentication status" });
    }
  });

  app.get("/api/auth/login-url", (req, res) => {
    try {
      const loginUrl = metaApiService.getLoginUrl();
      res.json({ url: loginUrl });
    } catch (error) {
      console.error("Error generating login URL:", error);
      res.status(500).json({ message: "Failed to generate login URL" });
    }
  });

  app.get("/api/auth/callback", async (req, res) => {
    try {
      const { code } = req.query;
      
      if (typeof code !== "string") {
        return res.status(400).json({ message: "Invalid authorization code" });
      }
      
      const token = await metaApiService.exchangeCodeForToken(code);
      
      // Save token to database
      await appStorage.saveAuthToken({
        accessToken: token.access_token,
        refreshToken: token.refresh_token || null,
        expiresAt: new Date(Date.now() + token.expires_in * 1000),
      });
      
      // Log success
      await appStorage.createActivityLog({
        type: "success",
        message: "Connected to Meta Ads API",
        timestamp: new Date(),
      });
      
      // Close the popup window
      res.send(`
        <html>
          <body>
            <script>
              window.close();
            </script>
            <p>Authentication successful. You can close this window.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Auth callback error:", error);
      
      // Log error
      await appStorage.createActivityLog({
        type: "error",
        message: `Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      });
      
      res.status(500).send(`
        <html>
          <body>
            <script>
              window.close();
            </script>
            <p>Authentication failed. Please try again.</p>
          </body>
        </html>
      `);
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    try {
      // Clear token from database
      await appStorage.clearAuthTokens();
      
      res.json({ success: true });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ message: "Failed to logout" });
    }
  });

  // Campaign routes
  app.get("/api/campaigns", async (req, res) => {
    try {
      console.log("Fetching campaigns...");
      
      const token = await getAccessToken();
      console.log("Fetching campaigns from Meta API...");
      
      // Get campaigns from Meta API
      const campaigns = await metaApiService.getCampaigns(token);
      
      console.log(`Fetched ${campaigns.length} campaigns successfully`);
      
      // Save campaigns to database (for caching)
      for (const campaign of campaigns) {
        await appStorage.upsertCampaign(campaign);
      }
      
      res.json(campaigns);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      
      // Log error
      await appStorage.createActivityLog({
        type: "error",
        message: `Failed to fetch campaigns: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      });
      
      res.status(500).json({ message: "Failed to fetch campaigns" });
    }
  });
  
  // Test route for fetching pages
  app.get("/api/pages", async (req, res) => {
    try {
      console.log("Fetching pages...");
      
      const token = await getAccessToken();
      console.log("Fetching pages from Meta API...");
      
      // Get pages from Meta API
      const pages = await metaApiService.getPages(token);
      
      console.log(`Fetched ${pages.length} pages successfully`);
      
      res.json(pages);
    } catch (error) {
      console.error("Error fetching pages:", error);
      
      // Log error
      await appStorage.createActivityLog({
        type: "error",
        message: `Failed to fetch pages: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      });
      
      res.status(500).json({ message: "Failed to fetch pages" });
    }
  });

  // File upload routes
  app.post("/api/files/upload", upload.single("file"), async (req, res) => {
    try {
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      // Check if file is .mov
      if (!file.originalname.endsWith(".mov")) {
        return res.status(400).json({ message: "Only .mov files are allowed" });
      }
      
      // Save file info to database
      const savedFile = await appStorage.createFile({
        name: file.originalname,
        path: file.path,
        size: file.size,
        type: file.mimetype,
        status: "ready",
        metaAssetId: null,
      });
      
      // Log success
      await appStorage.createActivityLog({
        type: "success",
        message: `File "${file.originalname}" uploaded successfully`,
        timestamp: new Date(),
      });
      
      res.json({
        fileId: savedFile.id.toString(),
        name: savedFile.name,
        size: savedFile.size,
        path: savedFile.path,
      });
    } catch (error) {
      console.error("File upload error:", error);
      
      // Log error
      await appStorage.createActivityLog({
        type: "error",
        message: `File upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      });
      
      res.status(500).json({ message: "Failed to upload file" });
    }
  });

  // Creative launch routes
  app.post("/api/creatives/launch", async (req, res) => {
    try {
      console.log("Starting creative launch process...");
      
      // Validate request body
      const schema = z.object({
        files: z.array(z.object({
          id: z.string(),
          path: z.string(),
          name: z.string(),
        })),
        campaignIds: z.array(z.string()),
      });
      
      const { files, campaignIds } = schema.parse(req.body);
      
      console.log(`Received request to launch ${files.length} files to ${campaignIds.length} campaigns`);
      console.log("Files:", JSON.stringify(files));
      console.log("Campaign IDs:", campaignIds);
      
      const accessToken = await getAccessToken();
      console.log("Authentication token valid, proceeding with creative launch");
      
      // Launch creatives
      const results = await Promise.allSettled(
        files.flatMap(file => 
          campaignIds.map(async (campaignId) => {
            console.log(`Processing file ID ${file.id} for campaign ${campaignId}`);
            
            // Get file from database
            const dbFile = await appStorage.getFileById(parseInt(file.id));
            
            if (!dbFile) {
              console.error(`File with ID ${file.id} not found in database`);
              throw new Error(`File with ID ${file.id} not found`);
            }
            
            console.log(`Retrieved file from database: ${JSON.stringify(dbFile)}`);
            
            try {
              // Upload file to Meta
              console.log(`Uploading file "${dbFile.name}" (${dbFile.path}) to Meta`);
              const uploadResult = await fileService.uploadFileToMeta(accessToken, dbFile.path);
              console.log(`Upload to Meta successful, received asset ID: ${uploadResult.id}`);
              
              // Update file with Meta asset ID
              await appStorage.updateFile(dbFile.id, {
                metaAssetId: uploadResult.id,
              });
              console.log(`Updated file ${dbFile.id} with Meta asset ID ${uploadResult.id}`);
              
              // Create ad creative in Meta
              console.log(`Creating ad creative for campaign ${campaignId}`);
              const creativeResult = await metaApiService.createAdCreative(
                accessToken,
                campaignId,
                uploadResult.id,
                dbFile.name
              );
              console.log(`Creative created in Meta with ID: ${creativeResult.id}`);
              
              // Save creative to database
              const creative = await appStorage.createCreative({
                fileId: dbFile.id,
                campaignId,
                metaCreativeId: creativeResult.id,
                status: "completed",
              });
              console.log(`Saved creative to database with ID: ${creative.id}`);
              
              // Update file status
              await appStorage.updateFile(dbFile.id, {
                status: "completed",
              });
              console.log(`Updated file status to "completed"`);
              
              // Log success
              await appStorage.createActivityLog({
                type: "success",
                message: `Creative "${dbFile.name}" launched to campaign "${campaignId}"`,
                timestamp: new Date(),
              });
              console.log(`Created success activity log entry`);
              
              return creative;
            } catch (error) {
              console.error(`Error processing file ${dbFile.id} for campaign ${campaignId}:`, error);
              throw error; // Re-throw to be caught by Promise.allSettled
            }
          })
        )
      );
      
      // Count successes and errors
      const successCount = results.filter(r => r.status === "fulfilled").length;
      const errorCount = results.filter(r => r.status === "rejected").length;
      
      console.log(`Processed all files: ${successCount} successes, ${errorCount} errors`);
      
      // Extract created creative IDs and errors
      const creativeIds = results
        .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
        .map(r => r.value.id.toString());
      
      const errors = results
        .filter((r): r is PromiseRejectedResult => r.status === "rejected")
        .map(r => r.reason);
      
      const errorMessages = errors.map(e => e instanceof Error ? e.message : String(e));
      console.log(`Error messages:`, errorMessages);
      
      res.json({
        successCount,
        errorCount,
        creativeIds,
        errors: errorMessages,
      });
    } catch (error) {
      console.error("Creative launch error:", error);
      
      // Handle validation errors
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        console.log(`Validation error: ${validationError.message}`);
        return res.status(400).json({ message: validationError.message });
      }
      
      // Log error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await appStorage.createActivityLog({
        type: "error",
        message: `Failed to launch creatives: ${errorMessage}`,
        timestamp: new Date(),
      });
      console.log(`Created error activity log entry: ${errorMessage}`);
      
      res.status(500).json({ message: "Failed to launch creatives" });
    }
  });

  // Performance report routes
  app.post("/api/reports/generate", async (req, res) => {
    try {
      const schema = z.object({
        dateRange: z.object({
          since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        }).optional(),
        campaignIds: z.array(z.string()).optional(),
        spreadsheetId: z.string().optional(),
        metrics: z.array(z.string()).optional(),
      });

      const { dateRange, campaignIds, spreadsheetId, metrics } = schema.parse(req.body);
      
      const accessToken = await getAccessToken();
      
      console.log(`Generating performance report${dateRange ? ` for ${dateRange.since} to ${dateRange.until}` : ' for all available data'}`);
      
      const result = await performanceReportService.generateReport(accessToken, {
        dateRange,
        campaignIds,
        spreadsheetId,
        metrics,
      });

      // Log success
      await appStorage.createActivityLog({
        type: "success",
        message: `Performance report generated: ${result.dataExported} records exported to Google Sheets`,
        timestamp: new Date(),
      });

      res.json(result);
    } catch (error) {
      console.error("Error generating performance report:", error);
      
      // Handle validation errors
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      
      // Log error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await appStorage.createActivityLog({
        type: "error",
        message: `Failed to generate performance report: ${errorMessage}`,
        timestamp: new Date(),
      });
      
      res.status(500).json({ message: "Failed to generate performance report" });
    }
  });

  app.get("/api/reports/date-presets", (_req, res) => {
    try {
      const presets = performanceReportService.getDateRangePresets();
      res.json(presets);
    } catch (error) {
      console.error("Error getting date presets:", error);
      res.status(500).json({ message: "Failed to get date presets" });
    }
  });

  app.get("/api/insights", async (req, res) => {
    try {
      const schema = z.object({
        since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        campaignIds: z.string().optional(),
      });

      const { since, until, campaignIds } = schema.parse(req.query);
      
      const accessToken = await getAccessToken();
      
      let insights;
      if (campaignIds) {
        const campaignIdArray = campaignIds.split(',');
        insights = await metaApiService.getCampaignInsights(accessToken, campaignIdArray, { since, until });
      } else {
        insights = await metaApiService.getAdAccountInsights(accessToken, { since, until });
      }

      res.json(insights);
    } catch (error) {
      console.error("Error fetching insights:", error);
      
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      
      res.status(500).json({ message: "Failed to fetch campaign insights" });
    }
  });

  // Activity log routes
  app.get("/api/logs", async (_req, res) => {
    try {
      const logs = await appStorage.getActivityLogs();
      res.json(logs);
    } catch (error) {
      console.error("Error fetching logs:", error);
      res.status(500).json({ message: "Failed to fetch activity logs" });
    }
  });
  
  // Check Meta API setup (including page connections)
  app.get("/api/meta/status", async (_req, res) => {
    try {
      try {
        const token = await getAccessToken();
        
        // Check if ad account exists
        let adAccountId = process.env.META_AD_ACCOUNT_ID;
        const hasAdAccount = !!adAccountId;
        
        // Check if pages exist
        const pages = await metaApiService.getPages(token);
        const hasPages = pages.length > 0;
        // Check if using the real page provided by the user (ID: 118677978328614)
        const isRealPage = pages.length > 0 && pages[0].id === "118677978328614";
        
        // Check if campaigns exist
        const campaigns = await metaApiService.getCampaigns(token);
        const hasCampaigns = campaigns.length > 0;
        
        // Determine status
        let status = "ready";
        let message = "Meta API is properly configured";
        
        if (!hasAdAccount) {
          status = "missing_ad_account";
          message = "No ad account connected";
        } else if (!isRealPage) {
          status = "missing_page";
          message = "No Facebook Page connected to your ad account. Using a test page which may not work in production.";
        } else if (!hasCampaigns) {
          status = "missing_campaigns";
          message = "No campaigns found in your ad account";
        }
        
        res.json({
          authenticated: true,
          adAccount: hasAdAccount,
          pages: hasPages,
          realPage: isRealPage,
          campaigns: hasCampaigns,
          status,
          message
        });
      } catch (error) {
        // If error is about authentication, return structured response
        if (error instanceof Error && 
            (error.message.includes("Not authenticated") || 
             error.message.includes("Token expired"))) {
          return res.json({
            authenticated: false,
            adAccount: false,
            pages: false,
            campaigns: false,
            status: "not_authenticated",
            message: error.message
          });
        }
        
        // Otherwise, re-throw for general error handling
        throw error;
      }
    } catch (error) {
      console.error("Error checking Meta status:", error);
      res.status(500).json({ 
        authenticated: false,
        status: "error",
        message: "Failed to check Meta API status" 
      });
    }
  });



  // AI Script Generation endpoints
  app.post('/api/ai-scripts/generate', async (req, res) => {
    try {
      const { spreadsheetId, voiceId, includeVoice = false } = req.body;

      if (!spreadsheetId) {
        return res.status(400).json({ error: 'Spreadsheet ID is required' });
      }

      const result = await aiScriptService.generateScriptSuggestions(spreadsheetId, {
        voiceId,
        includeVoice
      });
      res.json(result);
    } catch (error: any) {
      console.error('Error generating AI scripts:', error);
      res.status(500).json({ 
        error: 'Failed to generate AI scripts',
        details: error.message 
      });
    }
  });

  // Unified workflow endpoint
  app.post('/api/unified/generate', async (req, res) => {
    try {
      const { dateRange, campaignIds, spreadsheetId } = req.body;

      if (!spreadsheetId) {
        return res.status(400).json({ error: 'Spreadsheet ID is required' });
      }

      // Generate performance report first
      const reportResult = await performanceReportService.generateReport(
        await getAccessToken(),
        {
          dateRange,
          campaignIds,
          spreadsheetId: spreadsheetId.trim()
        }
      );

      // Generate AI scripts with voice
      const aiResult = await aiScriptService.generateScriptSuggestions(spreadsheetId, {
        includeVoice: true // Always include voice in unified workflow
      });
      
      return res.json({
        reportResult: reportResult,
        scriptResult: aiResult
      });
    } catch (error: any) {
      console.error('Error in unified generation:', error);
      res.status(500).json({ 
        error: 'Failed to generate unified report and scripts',
        details: error.message 
      });
    }
  });

  // ElevenLabs voice endpoints
  app.get('/api/elevenlabs/status', async (req, res) => {
    try {
      if (!process.env.ELEVENLABS_API_KEY) {
        return res.json({ 
          configured: false, 
          message: 'ElevenLabs API key not configured' 
        });
      }

      const accountInfo = await elevenLabsService.getAccountInfo();
      res.json({ 
        configured: true, 
        account: accountInfo,
        message: 'ElevenLabs is configured and ready' 
      });
    } catch (error: any) {
      console.error('Error checking ElevenLabs status:', error);
      res.status(500).json({ 
        configured: false,
        error: 'Failed to check ElevenLabs status',
        details: error.message 
      });
    }
  });

  app.get('/api/elevenlabs/voices', async (req, res) => {
    try {
      const voices = await elevenLabsService.getVoices();
      res.json(voices);
    } catch (error: any) {
      console.error('Error fetching voices:', error);
      res.status(500).json({ 
        error: 'Failed to fetch voices',
        details: error.message 
      });
    }
  });

  app.post('/api/elevenlabs/generate', async (req, res) => {
    try {
      const { text, voiceId, options = {} } = req.body;

      if (!text) {
        return res.status(400).json({ error: 'Text is required' });
      }

      const audioBuffer = await elevenLabsService.generateSpeech(text, voiceId, options);
      const filename = `voice_${Date.now()}`;
      const filePath = await elevenLabsService.saveAudioToFile(audioBuffer, filename);
      const audioUrl = `/uploads/${path.basename(filePath)}`;

      res.json({
        audioUrl,
        filename: path.basename(filePath),
        message: 'Voice generated successfully'
      });
    } catch (error: any) {
      console.error('Error generating voice:', error);
      res.status(500).json({ 
        error: 'Failed to generate voice',
        details: error.message 
      });
    }
  });

  // Download audio file endpoint
  app.get('/api/download/:filename', async (req, res) => {
    try {
      const { filename } = req.params;
      const filePath = path.join(__dirname, '../uploads', filename);
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
      }

      // Set proper headers for download
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'audio/mpeg');
      
      // Stream the file
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error: any) {
      console.error('Error downloading file:', error);
      res.status(500).json({ 
        error: 'Failed to download file',
        details: error.message 
      });
    }
  });

  // Bulk download endpoint for multiple files
  app.post('/api/download/bulk', async (req, res) => {
    try {
      const { filenames } = req.body;
      
      if (!filenames || !Array.isArray(filenames) || filenames.length === 0) {
        return res.status(400).json({ error: 'Filenames array is required' });
      }


      const archive = archiver('zip', { zlib: { level: 9 } });
      
      res.setHeader('Content-Disposition', 'attachment; filename="audio_files.zip"');
      res.setHeader('Content-Type', 'application/zip');
      
      archive.pipe(res);
      
      for (const filename of filenames) {
        const filePath = path.join(__dirname, '../uploads', filename);
        if (fs.existsSync(filePath)) {
          archive.file(filePath, { name: filename });
        }
      }
      
      archive.finalize();
    } catch (error: any) {
      console.error('Error creating bulk download:', error);
      res.status(500).json({ 
        error: 'Failed to create bulk download',
        details: error.message 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
