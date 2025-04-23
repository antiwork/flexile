import crypto from "crypto";
import { type ChatPostEphemeralArguments, type ChatPostMessageArguments, WebClient } from "@slack/web-api";
import { type CoreMessage } from "ai";
import { cache } from "react";
import env from "@/env";

export const slackClient = new WebClient(env.SLACK_TOKEN, {
  headers: {
    "Accept-Encoding": "identity",
  },
});

export const validSlackWebhookRequest = (body: string, headers: Headers) => {
  const slackSignature = headers.get("x-slack-signature");
  const timestamp = headers.get("x-slack-request-timestamp");
  const slackSigningSecret = env.SLACK_SIGNING_SECRET;

  if (
    !slackSignature ||
    !slackSigningSecret ||
    !timestamp ||
    new Date(Number(timestamp) * 1000).getTime() < Date.now() - 300 * 1000
  ) {
    return false;
  }

  const baseString = `v0:${timestamp}:${body}`;
  const hmac = crypto.createHmac("sha256", slackSigningSecret);
  const computedSignature = `v0=${hmac.update(baseString).digest("hex")}`;

  return crypto.timingSafeEqual(Buffer.from(computedSignature), Buffer.from(slackSignature));
};

export const postSlackMessage = async (
  token: string,
  {
    ephemeralUserId,
    ...options
  }: ChatPostMessageArguments & {
    ephemeralUserId?: string;
  },
) => {
  const client = new WebClient(token);
  const postMessage = async () => {
    if (ephemeralUserId) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- temporary
      const response = await client.chat.postEphemeral({
        ...options,
        user: ephemeralUserId,
      } as ChatPostEphemeralArguments);
      if (!response.message_ts) {
        throw new Error(`Failed to post Slack message: ${response.error}`);
      }
      return response.message_ts;
    }
    const response = await client.chat.postMessage(options);
    if (!response.message?.ts) {
      throw new Error(`Failed to post Slack message: ${response.error}`);
    }
    return response.message.ts;
  };

  const addBotToSlackChannel = async () => {
    await client.conversations.join({ channel: options.channel });
  };

  try {
    return await postMessage();
  } catch (error) {
    if (error instanceof Error && error.message.includes("not_in_channel")) {
      await addBotToSlackChannel();
      return await postMessage();
    }
    throw error;
  }
};

export const getThreadMessages = cache(
  async (token: string, channelId: string, threadTs: string, botUserId: string): Promise<CoreMessage[]> => {
    const client = new WebClient(token);
    const { messages } = await client.conversations.replies({
      channel: channelId,
      ts: threadTs,
      limit: 50,
    });

    if (!messages) throw new Error("No messages found in thread");

    const result = messages.flatMap((message) => {
      const isBot = !!message.bot_id;
      if (!message.text) return [];

      // For app mentions, remove the mention prefix
      // For IM messages, keep the full text
      let content = message.text;
      if (!isBot && content.includes(`<@${botUserId}>`)) {
        content = content.replace(`<@${botUserId}> `, "");
      }

      return [
        {
          role: isBot ? "assistant" : "user",
          content,
        } satisfies CoreMessage,
      ];
    });

    return result;
  },
);
