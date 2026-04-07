/**
 * sendAlert — fires a notification when something goes wrong.
 * If SLACK_WEBHOOK_URL is set, posts to Slack. Always logs to stderr.
 * Designed to be fire-and-forget; never throws.
 */
import { config } from "./config";
import { logger } from "./logger";

export async function sendAlert(message: string, context?: Record<string, unknown>): Promise<void> {
  // Always log so it appears in Railway logs and log drains.
  logger.error({ alert: true, message, ...context });

  if (!config.slackWebhookUrl) return;

  try {
    await fetch(config.slackWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `🚨 *ERP Forge Alert*\n${message}`,
        ...(context && {
          attachments: [
            {
              color: "danger",
              text: "```" + JSON.stringify(context, null, 2) + "```",
            },
          ],
        }),
      }),
    });
  } catch (err) {
    // Do not throw — alerting failure must never crash the main request.
    logger.warn({ err }, "Failed to send Slack alert");
  }
}
