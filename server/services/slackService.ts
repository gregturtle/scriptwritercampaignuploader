import { WebClient, type ChatPostMessageArguments } from '@slack/web-api';

interface BatchApprovalResult {
  success: boolean;
  messageTs?: string;
  error?: string;
}

class SlackService {
  private client!: WebClient;
  private isInitialized = false;

  constructor() {
    if (process.env.SLACK_BOT_TOKEN) {
      this.client = new WebClient(process.env.SLACK_BOT_TOKEN);
      this.isInitialized = true;
      console.log('Slack service initialized successfully');
    } else {
      console.warn('SLACK_BOT_TOKEN not found - Slack features disabled');
    }
  }

  isConfigured(): boolean {
    return this.isInitialized && !!process.env.SLACK_CHANNEL_ID;
  }

  /**
   * Send a video batch for team approval with reaction-based voting
   */
  async sendBatchForApproval(batchData: {
    batchId: string;
    folderName: string;
    folderLink: string;
    videoCount: number;
    videos: Array<{
      title: string;
      driveLink?: string;
    }>;
  }): Promise<BatchApprovalResult> {
    if (!this.isConfigured()) {
      throw new Error('Slack service not configured. Missing SLACK_BOT_TOKEN or SLACK_CHANNEL_ID');
    }

    try {
      const channel = process.env.SLACK_CHANNEL_ID!;
      
      // Create formatted video list
      const videoList = batchData.videos
        .map((video, index) => {
          const link = video.driveLink ? ` (<${video.driveLink}|view>)` : '';
          return `${index + 1}. ${video.title}${link}`;
        })
        .join('\n');

      const message: ChatPostMessageArguments = {
        channel,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '🎬 New Video Batch Ready for Review'
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Batch:* ${batchData.folderName}\n*Videos:* ${batchData.videoCount} videos\n*Folder:* <${batchData.folderLink}|View in Google Drive>`
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Video List:*\n${videoList}`
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*Team Approval Required:*\n• ✅ = Approve batch for Meta campaigns\n• ❌ = Reject batch (needs revision)'
            }
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `Batch ID: ${batchData.batchId} | Generated: ${new Date().toLocaleString()}`
              }
            ]
          }
        ]
      };

      console.log(`Sending batch approval request to Slack channel: ${channel}`);
      
      const response = await this.client.chat.postMessage(message);
      
      if (response.ok && response.ts) {
        // Add reaction options for voting
        await Promise.all([
          this.client.reactions.add({
            channel,
            timestamp: response.ts,
            name: 'white_check_mark'
          }),
          this.client.reactions.add({
            channel,
            timestamp: response.ts,
            name: 'x'
          })
        ]);

        console.log(`Batch approval message sent successfully. Message TS: ${response.ts}`);
        
        return {
          success: true,
          messageTs: response.ts
        };
      } else {
        throw new Error(`Slack API error: ${response.error || 'Unknown error'}`);
      }

    } catch (error) {
      console.error('Error sending batch approval to Slack:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send to Slack'
      };
    }
  }

  /**
   * Send a simple notification message
   */
  async sendNotification(message: string): Promise<boolean> {
    if (!this.isConfigured()) {
      console.warn('Cannot send notification - Slack not configured');
      return false;
    }

    try {
      const response = await this.client.chat.postMessage({
        channel: process.env.SLACK_CHANNEL_ID!,
        text: message
      });

      return response.ok || false;
    } catch (error) {
      console.error('Error sending Slack notification:', error);
      return false;
    }
  }

  /**
   * Get message reactions to check approval status
   */
  async getMessageReactions(messageTs: string): Promise<{
    approvals: number;
    rejections: number;
    total: number;
  }> {
    if (!this.isConfigured()) {
      throw new Error('Slack service not configured');
    }

    try {
      const response = await this.client.reactions.get({
        channel: process.env.SLACK_CHANNEL_ID!,
        timestamp: messageTs
      });

      if (!response.ok || !response.message?.reactions) {
        return { approvals: 0, rejections: 0, total: 0 };
      }

      const reactions = response.message.reactions;
      const approvals = reactions.find(r => r.name === 'white_check_mark')?.count || 0;
      const rejections = reactions.find(r => r.name === 'x')?.count || 0;

      return {
        approvals,
        rejections,
        total: approvals + rejections
      };
    } catch (error) {
      console.error('Error getting message reactions:', error);
      return { approvals: 0, rejections: 0, total: 0 };
    }
  }

  /**
   * Test Slack connection
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Slack service not configured. Missing SLACK_BOT_TOKEN or SLACK_CHANNEL_ID'
      };
    }

    try {
      const response = await this.client.auth.test();
      
      if (response.ok) {
        return { success: true };
      } else {
        return {
          success: false,
          error: response.error || 'Authentication failed'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed'
      };
    }
  }
}

export const slackService = new SlackService();