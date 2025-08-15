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
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*🚨 URGENT REVIEW REQUIRED 🚨*\n\n*THIS IS A FRESH BATCH OF NEW CONCEPTS*\n\n**ALL VIDEOS MUST BE APPROVED OR REJECTED BEFORE THE NEXT TEST CAN COMMENCE**\n\n*Instructions:*\n• Each ad needs **ONE PERSON** to react with ✅ (approve) or ❌ (reject)\n• Watch the video by clicking the link\n• React immediately after reviewing\n• **DO NOT PROCEED** until all ads are reviewed`
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
   * Checks if all ads in a batch have been reviewed and sends summary
   */
  async checkBatchCompletion(
    batchName: string,
    messageTimestamps: string[],
    totalAds: number
  ): Promise<void> {
    try {
      let approvedCount = 0;
      let rejectedCount = 0;
      let reviewedCount = 0;

      for (const messageTs of messageTimestamps) {
        const reactions = await slack.reactions.get({
          channel: process.env.SLACK_CHANNEL_ID!,
          timestamp: messageTs,
        });

        if (reactions.message?.reactions) {
          let hasApproval = false;
          let hasRejection = false;

          for (const reaction of reactions.message.reactions) {
            if (reaction.name === 'white_check_mark' && reaction.count && reaction.count > 0) {
              hasApproval = true;
            }
            if (reaction.name === 'x' && reaction.count && reaction.count > 0) {
              hasRejection = true;
            }
          }

          if (hasApproval || hasRejection) {
            reviewedCount++;
            if (hasApproval) approvedCount++;
            if (hasRejection) rejectedCount++;
          }
        }
      }

      // Send summary if all ads are reviewed
      if (reviewedCount === totalAds) {
        const summaryMessage: ChatPostMessageArguments = {
          channel: process.env.SLACK_CHANNEL_ID!,
          text: `Batch ${batchName} review complete`,
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: '✅ BATCH REVIEW COMPLETE'
              }
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*${batchName.toUpperCase()} REVIEW SUMMARY*\n\n**ALL VIDEOS HAVE NOW BEEN REVIEWED**\n\n📊 *Results:*\n• ✅ Approved: ${approvedCount} videos\n• ❌ Rejected: ${rejectedCount} videos\n• 📋 Total reviewed: ${reviewedCount}/${totalAds}\n\n**NEXT TEST CAN NOW COMMENCE** 🚀`
              }
            }
          ]
        };

        await this.sendMessage(summaryMessage);
      }
    } catch (error) {
      console.error('Error checking batch completion:', error);
      // Don't throw here as this is a monitoring function
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