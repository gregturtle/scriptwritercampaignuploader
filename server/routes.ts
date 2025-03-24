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
      // Get token from database
      const token = await appStorage.getLatestAuthToken();
      
      if (!token) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      // Check if token is expired
      if (new Date(token.expiresAt) <= new Date()) {
        return res.status(401).json({ message: "Token expired, please login again" });
      }
      
      // Get campaigns from Meta API
      const campaigns = await metaApiService.getCampaigns(token.accessToken);
      
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
      
      // Get token from database
      const token = await appStorage.getLatestAuthToken();
      
      if (!token) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      // Check if token is expired
      if (new Date(token.expiresAt) <= new Date()) {
        return res.status(401).json({ message: "Token expired, please login again" });
      }
      
      // Launch creatives
      const results = await Promise.allSettled(
        files.flatMap(file => 
          campaignIds.map(async (campaignId) => {
            // Get file from database
            const dbFile = await appStorage.getFileById(parseInt(file.id));
            
            if (!dbFile) {
              throw new Error(`File with ID ${file.id} not found`);
            }
            
            // Upload file to Meta
            const uploadResult = await fileService.uploadFileToMeta(token.accessToken, dbFile.path);
            
            // Update file with Meta asset ID
            await appStorage.updateFile(dbFile.id, {
              metaAssetId: uploadResult.id,
            });
            
            // Create ad creative in Meta
            const creativeResult = await metaApiService.createAdCreative(
              token.accessToken,
              campaignId,
              uploadResult.id,
              dbFile.name
            );
            
            // Save creative to database
            const creative = await appStorage.createCreative({
              fileId: dbFile.id,
              campaignId,
              metaCreativeId: creativeResult.id,
              status: "completed",
            });
            
            // Update file status
            await appStorage.updateFile(dbFile.id, {
              status: "completed",
            });
            
            // Log success
            await appStorage.createActivityLog({
              type: "success",
              message: `Creative "${dbFile.name}" launched to campaign "${campaignId}"`,
              timestamp: new Date(),
            });
            
            return creative;
          })
        )
      );
      
      // Count successes and errors
      const successCount = results.filter(r => r.status === "fulfilled").length;
      const errorCount = results.filter(r => r.status === "rejected").length;
      
      // Extract created creative IDs and errors
      const creativeIds = results
        .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
        .map(r => r.value.id.toString());
      
      const errors = results
        .filter((r): r is PromiseRejectedResult => r.status === "rejected")
        .map(r => r.reason);
      
      res.json({
        successCount,
        errorCount,
        creativeIds,
        errors: errors.map(e => e instanceof Error ? e.message : String(e)),
      });
    } catch (error) {
      console.error("Creative launch error:", error);
      
      // Handle validation errors
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      
      // Log error
      await appStorage.createActivityLog({
        type: "error",
        message: `Failed to launch creatives: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      });
      
      res.status(500).json({ message: "Failed to launch creatives" });
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

  const httpServer = createServer(app);
  return httpServer;
}
