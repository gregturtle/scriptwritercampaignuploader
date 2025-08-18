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
              text: `*🚨 URGENT REVIEW REQUIRED 🚨*\n\n*THIS IS A FRESH BATCH OF NEW CONCEPTS*\n\n**ALL VIDEOS MUST BE APPROVED OR REJECTED BEFORE THE NEXT TEST CAN COMMENCE**\n\n*Instructions:*\n• Each ad needs **ONE PERSON** to react with ✅ (approve) or ❌ (reject)\n• **MANUALLY ADD** your own ✅ or ❌ reaction to each message below\n• Watch the video by clicking the Google Drive link\n• React immediately after reviewing\n• **DO NOT PROCEED** until all ads are reviewed`
            }
          },
          {
            type: 'divider'
          }
        ]
      };

      await this.sendMessage(headerMessage);

      // Track message timestamps for batch monitoring
      const messageTimestamps: string[] = [];

      // Send individual messages for each ad with reactions
      for (let i = 0; i < batchInfo.scripts.length; i++) {
        const script = batchInfo.scripts[i];
        const scriptNumber = i + 1;
        const fileName = script.fileName || `script${scriptNumber}`;
        
        console.log(`Slack script ${scriptNumber} data:`, {
          title: script.title,
          videoUrl: script.videoUrl,
          videoFileId: script.videoFileId
        });
        
        // Create properly formatted Google Drive link
        let videoLink = script.videoUrl;
        if (script.videoFileId) {
          videoLink = `https://drive.google.com/file/d/${script.videoFileId}/view?usp=drive_link`;
        }
        
        let adText = `*🎬 AD ${scriptNumber}: ${script.title}*\n`;
        adText += `📁 *File:* \`${fileName}\`\n`;
        adText += `💬 *Script:* "${script.content}"\n`;

        // Add Google Drive video link with proper formatting
        if (videoLink) {
          adText += `\n🎥 *Video:* ${videoLink}`;
        } else {
          adText += `\n⚠️ Video not yet uploaded to Drive`;
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
        
        // Track message for monitoring (no auto-reactions)
        if (messageTs) {
          messageTimestamps.push(messageTs);
          // Removed auto-reactions - users will add their own ✅ or ❌
        }
      }

      // Start monitoring the batch for completion (check every 30 seconds)
      setTimeout(() => {
        this.monitorBatchCompletion(batchInfo.batchName, messageTimestamps, batchInfo.scripts.length);
      }, 30000);

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
   * Monitors batch completion with periodic checks
   */
  private async monitorBatchCompletion(
    batchName: string,
    messageTimestamps: string[],
    totalAds: number,
    attempts: number = 0
  ): Promise<void> {
    const maxAttempts = 40; // Check for 20 minutes (40 * 30 seconds)
    
    try {
      console.log(`[SLACK MONITOR] Monitoring attempt ${attempts + 1}/${maxAttempts} for ${batchName}`);
      const isComplete = await this.checkBatchCompletion(batchName, messageTimestamps, totalAds);
      
      if (!isComplete && attempts < maxAttempts) {
        // Continue monitoring every 30 seconds
        setTimeout(() => {
          this.monitorBatchCompletion(batchName, messageTimestamps, totalAds, attempts + 1);
        }, 30000);
      } else if (attempts >= maxAttempts) {
        console.log(`[SLACK MONITOR] Monitoring timeout for ${batchName} after ${maxAttempts} attempts`);
      }
    } catch (error) {
      console.error(`[SLACK MONITOR] Error monitoring batch completion for ${batchName}:`, error);
    }
  }

  /**
   * Checks if all ads in a batch have been reviewed and sends summary
   */
  async checkBatchCompletion(
    batchName: string,
    messageTimestamps: string[],
    totalAds: number
  ): Promise<boolean> {
    try {
      console.log(`[SLACK MONITOR] Checking batch completion for ${batchName} - ${messageTimestamps.length} messages, ${totalAds} total ads`);
      
      let approvedCount = 0;
      let rejectedCount = 0;
      let reviewedCount = 0;

      for (const messageTs of messageTimestamps) {
        const reactions = await slack.reactions.get({
          channel: process.env.SLACK_CHANNEL_ID!,
          timestamp: messageTs,
        });

        console.log(`[SLACK MONITOR] Message ${messageTs} reactions:`, reactions.message?.reactions);

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
            console.log(`[SLACK MONITOR] Message ${messageTs} reviewed - approved: ${hasApproval}, rejected: ${hasRejection}`);
          }
        }
      }

      console.log(`[SLACK MONITOR] Batch status - Reviewed: ${reviewedCount}/${totalAds}, Approved: ${approvedCount}, Rejected: ${rejectedCount}`);

      // Check if we have permission to read reactions
      if (reviewedCount === 0 && messageTimestamps.length > 0) {
        console.log(`[SLACK MONITOR] WARNING: No reactions found. Bot may need 'reactions:read' permission.`);
      }

      // Send summary if all ads are reviewed
      if (reviewedCount === totalAds) {
        console.log(`[SLACK MONITOR] Sending completion summary for ${batchName}`);
        
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

        try {
          await this.sendMessage(summaryMessage);
          console.log(`[SLACK MONITOR] Summary message sent successfully for ${batchName}`);
        } catch (error) {
          console.error(`[SLACK MONITOR] Failed to send summary message:`, error);
        }
        
        return true; // Batch is complete
      }
      
      return false; // Batch is not complete yet
    } catch (error) {
      console.error('Error checking batch completion:', error);
      // Don't throw here as this is a monitoring function
      return false;
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