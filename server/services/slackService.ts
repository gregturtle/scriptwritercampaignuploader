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
      scripts: Array<{ title: string; content: string }>;
      driveFolder: string;
      timestamp: string;
    }
  ): Promise<string | undefined> {
    try {
      const scriptsList = batchInfo.scripts
        .map((script, index) => `${index + 1}. *${script.title}*\n   "${script.content}"`)
        .join('\n\n');

      const message: ChatPostMessageArguments = {
        channel: process.env.SLACK_CHANNEL_ID!,
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
            fields: [
              {
                type: 'mrkdwn',
                text: `*Batch:* ${batchInfo.batchName}`
              },
              {
                type: 'mrkdwn',
                text: `*Videos:* ${batchInfo.videoCount}`
              },
              {
                type: 'mrkdwn',
                text: `*Generated:* ${batchInfo.timestamp}`
              },
              {
                type: 'mrkdwn',
                text: `*Drive Folder:* <${batchInfo.driveFolder}|View Videos>`
              }
            ]
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Generated Scripts:*\n${scriptsList}`
            }
          },
          {
            type: 'divider'
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '👍 React with ✅ to approve or ❌ to reject this batch'
            }
          }
        ]
      };

      const messageTs = await this.sendMessage(message);

      // Add reactions to the message for voting
      if (messageTs) {
        await this.addReactions(messageTs, ['white_check_mark', 'x']);
      }

      return messageTs;
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