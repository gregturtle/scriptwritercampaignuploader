import { 
  AuthToken, InsertAuthToken, 
  File, InsertFile,
  Campaign, InsertCampaign,
  Creative, InsertCreative,
  ActivityLog, InsertActivityLog,
  authTokens,
  files,
  campaigns,
  creatives,
  activityLogs
} from "@shared/schema";
import { db } from './db';
import { eq, desc } from 'drizzle-orm';

// modify the interface with any CRUD methods
// you might need
export interface IStorage {
  // Auth tokens
  saveAuthToken(token: InsertAuthToken): Promise<AuthToken>;
  getLatestAuthToken(): Promise<AuthToken | undefined>;
  clearAuthTokens(): Promise<void>;
  
  // Files
  createFile(file: InsertFile): Promise<File>;
  getFileById(id: number): Promise<File | undefined>;
  updateFile(id: number, updates: Partial<InsertFile>): Promise<File>;
  
  // Campaigns
  upsertCampaign(campaign: InsertCampaign): Promise<Campaign>;
  getCampaignById(id: string): Promise<Campaign | undefined>;
  
  // Creatives
  createCreative(creative: InsertCreative): Promise<Creative>;
  getCreativesByFileId(fileId: number): Promise<Creative[]>;
  
  // Activity logs
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
  getActivityLogs(limit?: number): Promise<ActivityLog[]>;
}

export class DatabaseStorage implements IStorage {
  // Auth tokens
  async saveAuthToken(token: InsertAuthToken): Promise<AuthToken> {
    const [authToken] = await db
      .insert(authTokens)
      .values(token)
      .returning();
    
    return authToken;
  }

  async getLatestAuthToken(): Promise<AuthToken | undefined> {
    const [token] = await db
      .select()
      .from(authTokens)
      .orderBy(desc(authTokens.createdAt))
      .limit(1);
    
    return token;
  }

  async clearAuthTokens(): Promise<void> {
    await db.delete(authTokens);
  }
  
  // Files
  async createFile(file: InsertFile): Promise<File> {
    const [newFile] = await db
      .insert(files)
      .values(file)
      .returning();
    
    return newFile;
  }

  async getFileById(id: number): Promise<File | undefined> {
    const [file] = await db
      .select()
      .from(files)
      .where(eq(files.id, id))
      .limit(1);
    
    return file;
  }

  async updateFile(id: number, updates: Partial<InsertFile>): Promise<File> {
    const [updatedFile] = await db
      .update(files)
      .set(updates)
      .where(eq(files.id, id))
      .returning();
    
    if (!updatedFile) {
      throw new Error(`File with ID ${id} not found`);
    }
    
    return updatedFile;
  }
  
  // Campaigns
  async upsertCampaign(campaign: InsertCampaign): Promise<Campaign> {
    // Check if campaign exists
    const [existingCampaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaign.id))
      .limit(1);
    
    if (existingCampaign) {
      // Update
      const [updatedCampaign] = await db
        .update(campaigns)
        .set({
          ...campaign,
          updatedAt: new Date()
        })
        .where(eq(campaigns.id, campaign.id))
        .returning();
      
      return updatedCampaign;
    } else {
      // Insert
      const [newCampaign] = await db
        .insert(campaigns)
        .values(campaign)
        .returning();
      
      return newCampaign;
    }
  }

  async getCampaignById(id: string): Promise<Campaign | undefined> {
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, id))
      .limit(1);
    
    return campaign;
  }
  
  // Creatives
  async createCreative(creative: InsertCreative): Promise<Creative> {
    const [newCreative] = await db
      .insert(creatives)
      .values(creative)
      .returning();
    
    return newCreative;
  }

  async getCreativesByFileId(fileId: number): Promise<Creative[]> {
    return db
      .select()
      .from(creatives)
      .where(eq(creatives.fileId, fileId));
  }
  
  // Activity logs
  async createActivityLog(log: InsertActivityLog): Promise<ActivityLog> {
    // Make sure timestamp is set if not provided
    const logWithTimestamp = {
      ...log,
      timestamp: log.timestamp || new Date()
    };
    
    const [newLog] = await db
      .insert(activityLogs)
      .values(logWithTimestamp)
      .returning();
    
    return newLog;
  }

  async getActivityLogs(limit: number = 50): Promise<ActivityLog[]> {
    return db
      .select()
      .from(activityLogs)
      .orderBy(desc(activityLogs.timestamp))
      .limit(limit);
  }
}

export const storage = new DatabaseStorage();
