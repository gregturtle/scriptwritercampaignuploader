import express from "express";
import { createServer, type Server } from "http";
import { storage as dbStorage } from "./storage";
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
import { metaApiService, getRedirectUri } from "./services/metaApi";
import { fileService } from "./services/fileService";
import { googleDriveService } from "./services/googleDriveApi";

// Setup file upload middleware
const uploadDir = path.join(process.cwd(), "uploads");
// Create uploads directory if it doesn't exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const multerStorage = multer.diskStorage({
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
  storage: multerStorage,
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
      const token = await dbStorage.getLatestAuthToken();
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
      await dbStorage.saveAuthToken({
        accessToken: token.access_token,
        refreshToken: token.refresh_token || null,
        expiresAt: new Date(Date.now() + token.expires_in * 1000).toISOString(),
      });
      
      // Log success
      await dbStorage.createActivityLog({
        type: "success",
        message: "Connected to Meta Ads API",
        timestamp: new Date().toISOString(),
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
      await dbStorage.createActivityLog({
        type: "error",
        message: `Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
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
      await dbStorage.clearAuthTokens();
      
      res.json({ success: true });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ message: "Failed to logout" });
    }
  });
  
  // Google Drive auth routes
  app.get("/api/auth/google/login-url", (req, res) => {
    try {
      const loginUrl = googleDriveService.getAuthUrl();
      res.json({ url: loginUrl });
    } catch (error) {
      console.error("Error generating Google login URL:", error);
      res.status(500).json({ message: "Failed to generate Google login URL" });
    }
  });
  
  app.get("/api/auth/google/callback", async (req, res) => {
    try {
      const { code } = req.query;
      
      if (typeof code !== "string") {
        return res.status(400).json({ message: "Invalid authorization code" });
      }
      
      const tokens = await googleDriveService.exchangeCodeForTokens(code);
      
      // Save token to database with a special 'googleDrive' prefix to differentiate
      await dbStorage.saveAuthToken({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || null,
        expiresAt: new Date(tokens.expiry_date).toISOString(),
        provider: 'googleDrive' // Add this field to your schema if not already present
      });
      
      // Log success
      await dbStorage.createActivityLog({
        type: "success",
        message: "Connected to Google Drive API",
        timestamp: new Date().toISOString(),
      });
      
      // Close the popup window
      res.send(`
        <html>
          <body>
            <script>
              window.close();
            </script>
            <p>Google Drive authentication successful. You can close this window.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Google auth callback error:", error);
      
      // Log error
      await dbStorage.createActivityLog({
        type: "error",
        message: `Google authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
      });
      
      res.status(500).send(`
        <html>
          <body>
            <script>
              window.close();
            </script>
            <p>Google authentication failed. Please try again.</p>
          </body>
        </html>
      `);
    }
  });

  // Campaign routes
  app.get("/api/campaigns", async (req, res) => {
    try {
      // Get token from database
      const token = await dbStorage.getLatestAuthToken();
      
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
        await dbStorage.upsertCampaign(campaign);
      }
      
      res.json(campaigns);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      
      // Log error
      await dbStorage.createActivityLog({
        type: "error",
        message: `Failed to fetch campaigns: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
      });
      
      res.status(500).json({ message: "Failed to fetch campaigns" });
    }
  });

  // Google Drive routes
  app.get("/api/google-drive/files", async (req, res) => {
    try {
      // Get Google Drive token from database
      const tokens = await dbStorage.getAuthTokensByProvider('googleDrive');
      
      if (!tokens || tokens.length === 0) {
        return res.status(401).json({ message: "Not authenticated with Google Drive" });
      }
      
      // Use the latest token
      const token = tokens[0];
      
      // Check if token is expired
      if (new Date(token.expiresAt) <= new Date()) {
        return res.status(401).json({ message: "Google Drive token expired, please login again" });
      }
      
      // List .mov files from Google Drive
      const files = await googleDriveService.listMovFiles(token.accessToken);
      
      res.json(files);
    } catch (error) {
      console.error("Error fetching Google Drive files:", error);
      
      // Log error
      await dbStorage.createActivityLog({
        type: "error",
        message: `Failed to fetch Google Drive files: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
      });
      
      res.status(500).json({ message: "Failed to fetch Google Drive files" });
    }
  });
  
  app.post("/api/google-drive/download", async (req, res) => {
    try {
      const { fileId } = req.body;
      
      if (!fileId) {
        return res.status(400).json({ message: "File ID is required" });
      }
      
      // Get Google Drive token from database
      const tokens = await dbStorage.getAuthTokensByProvider('googleDrive');
      
      if (!tokens || tokens.length === 0) {
        return res.status(401).json({ message: "Not authenticated with Google Drive" });
      }
      
      // Use the latest token
      const token = tokens[0];
      
      // Check if token is expired
      if (new Date(token.expiresAt) <= new Date()) {
        return res.status(401).json({ message: "Google Drive token expired, please login again" });
      }
      
      // Download file from Google Drive
      const downloadedFile = await googleDriveService.downloadFile(token.accessToken, fileId, uploadDir);
      
      // Save file info to database
      const savedFile = await dbStorage.createFile({
        name: downloadedFile.name,
        path: downloadedFile.localPath,
        size: downloadedFile.size,
        type: downloadedFile.type,
        status: "ready",
        metaAssetId: null,
        source: "googleDrive",
      });
      
      // Log success
      await dbStorage.createActivityLog({
        type: "success",
        message: `File "${downloadedFile.name}" downloaded from Google Drive successfully`,
        timestamp: new Date().toISOString(),
      });
      
      res.json({
        fileId: savedFile.id.toString(),
        name: savedFile.name,
        size: savedFile.size,
        path: savedFile.localPath,
      });
    } catch (error) {
      console.error("Error downloading from Google Drive:", error);
      
      // Log error
      await dbStorage.createActivityLog({
        type: "error",
        message: `Google Drive download failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
      });
      
      res.status(500).json({ message: "Failed to download file from Google Drive" });
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
      const savedFile = await dbStorage.createFile({
        name: file.originalname,
        path: file.path,
        size: file.size,
        type: file.mimetype,
        status: "ready",
        metaAssetId: null,
      });
      
      // Log success
      await dbStorage.createActivityLog({
        type: "success",
        message: `File "${file.originalname}" uploaded successfully`,
        timestamp: new Date().toISOString(),
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
      await dbStorage.createActivityLog({
        type: "error",
        message: `File upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
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
      const token = await dbStorage.getLatestAuthToken();
      
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
            const dbFile = await dbStorage.getFileById(parseInt(file.id));
            
            if (!dbFile) {
              throw new Error(`File with ID ${file.id} not found`);
            }
            
            // Upload file to Meta
            const uploadResult = await fileService.uploadFileToMeta(token.accessToken, dbFile.path);
            
            // Update file with Meta asset ID
            await dbStorage.updateFile(dbFile.id, {
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
            const creative = await dbStorage.createCreative({
              fileId: dbFile.id,
              campaignId,
              metaCreativeId: creativeResult.id,
              status: "completed",
            });
            
            // Update file status
            await dbStorage.updateFile(dbFile.id, {
              status: "completed",
            });
            
            // Log success
            await dbStorage.createActivityLog({
              type: "success",
              message: `Creative "${dbFile.name}" launched to campaign "${campaignId}"`,
              timestamp: new Date().toISOString(),
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
      await dbStorage.createActivityLog({
        type: "error",
        message: `Failed to launch creatives: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
      });
      
      res.status(500).json({ message: "Failed to launch creatives" });
    }
  });

  // Activity log routes
  app.get("/api/logs", async (_req, res) => {
    try {
      const logs = await dbStorage.getActivityLogs();
      res.json(logs);
    } catch (error) {
      console.error("Error fetching logs:", error);
      res.status(500).json({ message: "Failed to fetch activity logs" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
