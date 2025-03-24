import { 
  AuthToken, InsertAuthToken, 
  File, InsertFile,
  Campaign, InsertCampaign,
  Creative, InsertCreative,
  ActivityLog, InsertActivityLog
} from "@shared/schema";

// modify the interface with any CRUD methods
// you might need
export interface IStorage {
  // Auth tokens
  saveAuthToken(token: InsertAuthToken): Promise<AuthToken>;
  getLatestAuthToken(): Promise<AuthToken | undefined>;
  getAuthTokensByProvider(provider: string): Promise<AuthToken[]>;
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

export class MemStorage implements IStorage {
  private authTokens: Map<number, AuthToken>;
  private files: Map<number, File>;
  private campaigns: Map<string, Campaign>;
  private creatives: Map<number, Creative>;
  private activityLogs: Map<number, ActivityLog>;
  
  private authTokenCounter: number;
  private fileCounter: number;
  private creativeCounter: number;
  private logCounter: number;

  constructor() {
    this.authTokens = new Map();
    this.files = new Map();
    this.campaigns = new Map();
    this.creatives = new Map();
    this.activityLogs = new Map();
    
    this.authTokenCounter = 1;
    this.fileCounter = 1;
    this.creativeCounter = 1;
    this.logCounter = 1;
  }

  // Auth tokens
  async saveAuthToken(token: InsertAuthToken): Promise<AuthToken> {
    const id = this.authTokenCounter++;
    const now = new Date().toISOString();
    
    const authToken: AuthToken = {
      id,
      ...token,
      createdAt: now,
    };
    
    this.authTokens.set(id, authToken);
    return authToken;
  }

  async getLatestAuthToken(): Promise<AuthToken | undefined> {
    const tokens = Array.from(this.authTokens.values());
    return tokens.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];
  }
  
  async getAuthTokensByProvider(provider: string): Promise<AuthToken[]> {
    const tokens = Array.from(this.authTokens.values());
    return tokens
      .filter(token => token.provider === provider)
      .sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }

  async clearAuthTokens(): Promise<void> {
    this.authTokens.clear();
  }
  
  // Files
  async createFile(file: InsertFile): Promise<File> {
    const id = this.fileCounter++;
    const now = new Date().toISOString();
    
    const newFile: File = {
      id,
      ...file,
      createdAt: now,
    };
    
    this.files.set(id, newFile);
    return newFile;
  }

  async getFileById(id: number): Promise<File | undefined> {
    return this.files.get(id);
  }

  async updateFile(id: number, updates: Partial<InsertFile>): Promise<File> {
    const file = this.files.get(id);
    
    if (!file) {
      throw new Error(`File with ID ${id} not found`);
    }
    
    const updatedFile: File = {
      ...file,
      ...updates,
    };
    
    this.files.set(id, updatedFile);
    return updatedFile;
  }
  
  // Campaigns
  async upsertCampaign(campaign: InsertCampaign): Promise<Campaign> {
    const now = new Date().toISOString();
    
    const existingCampaign = this.campaigns.get(campaign.id);
    
    if (existingCampaign) {
      const updatedCampaign: Campaign = {
        ...existingCampaign,
        ...campaign,
        updatedAt: now,
      };
      
      this.campaigns.set(campaign.id, updatedCampaign);
      return updatedCampaign;
    } else {
      const newCampaign: Campaign = {
        ...campaign,
        createdAt: now,
        updatedAt: now,
      };
      
      this.campaigns.set(campaign.id, newCampaign);
      return newCampaign;
    }
  }

  async getCampaignById(id: string): Promise<Campaign | undefined> {
    return this.campaigns.get(id);
  }
  
  // Creatives
  async createCreative(creative: InsertCreative): Promise<Creative> {
    const id = this.creativeCounter++;
    const now = new Date().toISOString();
    
    const newCreative: Creative = {
      id,
      ...creative,
      createdAt: now,
    };
    
    this.creatives.set(id, newCreative);
    return newCreative;
  }

  async getCreativesByFileId(fileId: number): Promise<Creative[]> {
    return Array.from(this.creatives.values())
      .filter(creative => creative.fileId === fileId);
  }
  
  // Activity logs
  async createActivityLog(log: InsertActivityLog): Promise<ActivityLog> {
    const id = this.logCounter++;
    
    const newLog: ActivityLog = {
      id,
      ...log,
    };
    
    this.activityLogs.set(id, newLog);
    return newLog;
  }

  async getActivityLogs(limit: number = 50): Promise<ActivityLog[]> {
    return Array.from(this.activityLogs.values())
      .sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      .slice(0, limit);
  }
}

export const storage = new MemStorage();
