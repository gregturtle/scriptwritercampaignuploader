import { type ChatPostMessageArguments, WebClient } from "@slack/web-api";

// Validate environment variables
if (!process.env.SLACK_BOT_TOKEN) {
  throw new Error("SLACK_BOT_TOKEN environment variable must be set");
}

if (!process.env.SLACK_CHANNEL_ID) {
  throw new Error("SLACK_CHANNEL_ID environment variable must be set");
}

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

export class SlackService {
  /**
   * Sends a structured message to the configured Slack channel
   */
  async sendMessage(message: ChatPostMessageArguments): Promise<string | undefined> {
    try {
      const response = await slack.chat.postMessage({
        ...message,
        channel: process.env.SLACK_CHANNEL_ID!,
      });

      return response.ts;
    } catch (error) {
      console.error('Error sending Slack message:', error);
      throw error;
    }
  }

  /**
   * Sends a video batch approval request to Slack with structured formatting
   */
  async sendVideoBatchForApproval(
    batchInfo: {
      batchName: string;
      videoCount: number;
      scripts: Array<{ 
        title: string; 
        content: string; 
        fileName?: string;
        videoUrl?: string;
        videoFileId?: string;
      }>;
      driveFolder: string;
      timestamp: string;
    }
  ): Promise<string | undefined> {
    try {
      // Send batch header message
      const headerMessage: ChatPostMessageArguments = {
        channel: process.env.SLACK_CHANNEL_ID!,
        text: `New video batch: ${batchInfo.batchName}`,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: `🚀 BATCH: ${batchInfo.batchName.toUpperCase()}`
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*📊 Batch Summary*\n• ${batchInfo.videoCount} videos created\n• Generated: ${batchInfo.timestamp}\n• <${batchInfo.driveFolder}|📁 View All Videos in Drive>`
            }
          },
          {
            type: 'divider'
          }
        ]
      };

      await this.sendMessage(headerMessage);

      // Send individual messages for each ad with reactions
      for (let i = 0; i < batchInfo.scripts.length; i++) {
        const script = batchInfo.scripts[i];
        const scriptNumber = i + 1;
        const fileName = script.fileName || `script${scriptNumber}`;
        
        // Create direct Google Drive file link if we have the file ID
        let videoLink = script.videoUrl;
        if (script.videoFileId) {
          videoLink = `https://drive.google.com/file/d/${script.videoFileId}/view`;
        }
        
        let adText = `*🎬 AD ${scriptNumber}: ${script.title}*\n`;
        adText += `📁 *File:* \`${fileName}\`\n`;
        adText += `💬 *Script:* "${script.content}"\n`;
        
        if (videoLink) {
          adText += `🎥 *Video:* <${videoLink}|▶️ Watch Video>`;
        }

        const adMessage: ChatPostMessageArguments = {
          channel: process.env.SLACK_CHANNEL_ID!,
          text: `Ad ${scriptNumber}: ${script.title}`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: adText
              }
            }
          ]
        };

        const messageTs = await this.sendMessage(adMessage);
        
        // Add individual reactions for this ad
        if (messageTs) {
          await this.addReactions(messageTs, ['white_check_mark', 'x']);
        }
      }

      // Send final instruction message
      const footerMessage: ChatPostMessageArguments = {
        channel: process.env.SLACK_CHANNEL_ID!,
        text: 'Team approval needed',
        blocks: [
          {
            type: 'divider'
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*📋 APPROVAL INSTRUCTIONS*\nReact with ✅ to approve or ❌ to reject each individual ad above'
            }
          }
        ]
      };

      await this.sendMessage(footerMessage);

      return 'batch-sent';
    } catch (error) {
      console.error('Error sending video batch for approval:', error);
      throw error;
    }
  }

  /**
   * Adds reactions to a message for voting
   */
  private async addReactions(messageTs: string, reactions: string[]): Promise<void> {
    try {
      for (const reaction of reactions) {
        await slack.reactions.add({
          channel: process.env.SLACK_CHANNEL_ID!,
          timestamp: messageTs,
          name: reaction,
        });
      }
    } catch (error) {
      console.error('Error adding reactions:', error);
      // Don't throw here as the message was sent successfully
    }
  }

  /**
   * Sends a simple notification message
   */
  async sendNotification(text: string): Promise<string | undefined> {
    try {
      const message: ChatPostMessageArguments = {
        channel: process.env.SLACK_CHANNEL_ID!,
        text: text,
      };

      return await this.sendMessage(message);
    } catch (error) {
      console.error('Error sending notification:', error);
      throw error;
    }
  }
}

export const slackService = new SlackService();