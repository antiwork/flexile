import { AppMentionEvent, AssistantThreadStartedEvent, GenericMessageEvent, WebClient } from "@slack/web-api";
import { CoreMessage } from "ai";
import { companies } from "@/db/schema";
import { generateAgentResponse } from "@/lib/slack/agent/generateAgentResponse";
import { getThreadMessages } from "@/lib/slack/client";
import { assertDefined } from "@/utils/assert";

type Company = typeof companies.$inferSelect;

export async function handleMessage(event: GenericMessageEvent | AppMentionEvent, company: Company) {
  if (!company.slackBotUserId || event.bot_id || event.bot_id === company.slackBotUserId || event.bot_profile) return;

  const { thread_ts, channel } = event;
  const { showStatus, showResult } = await replyHandler(new WebClient(assertDefined(company.slackBotToken)), event);

  const messages = thread_ts
    ? await getThreadMessages(
        assertDefined(company.slackBotToken),
        channel,
        thread_ts,
        assertDefined(company.slackBotUserId),
      )
    : ([{ role: "user", content: event.text ?? "" }] as CoreMessage[]);
  const result = await generateAgentResponse(messages, company, event.user, showStatus);
  await showResult(result);
}

export async function handleAssistantThreadMessage(event: AssistantThreadStartedEvent, company: Company) {
  const client = new WebClient(assertDefined(company.slackBotToken));
  const { channel_id, thread_ts } = event.assistant_thread;

  await client.chat.postMessage({
    channel: channel_id,
    thread_ts,
    text: "Hello, I'm an AI assistant to help you work with Flexile!",
  });

  await client.assistant.threads.setSuggestedPrompts({
    channel_id,
    thread_ts,
    prompts: [
      {
        title: "Get weekly update",
        message: "What's my weekly update?",
      },
      {
        title: "Submit invoice",
        message: "Submit an invoice for $1000 for services rendered on 4/15/2025",
      },
      {
        title: "Update weekly update",
        message: "Update my weekly update to include that I'm working on the payments page",
      },
    ],
  });
}

export const isAgentThread = async (event: GenericMessageEvent, company: Company) => {
  if (!company.slackBotToken || !company.slackBotUserId || !event.thread_ts || event.thread_ts === event.ts) {
    return false;
  }

  if (event.text?.includes("(aside)")) return false;

  const client = new WebClient(company.slackBotToken);
  const { messages } = await client.conversations.replies({
    channel: event.channel,
    ts: event.thread_ts,
    limit: 50,
  });

  for (const message of messages ?? []) {
    if (message.user === company.slackBotUserId) return true;
  }

  return false;
};

const replyHandler = async (
  client: WebClient,
  event: { channel: string; thread_ts?: string; ts: string; text?: string },
) => {
  const debug = event.text && /(?:^|\s)!debug(?:$|\s)/u.test(event.text);
  const statusMessage = await client.chat.postMessage({
    channel: event.channel,
    thread_ts: event.thread_ts ?? event.ts,
    text: "_Thinking..._",
  });

  if (!statusMessage.ts) throw new Error("Failed to post initial message");

  const showStatus = async (status: string | null, debugContent?: unknown) => {
    if (debug) {
      await client.chat.postMessage({
        channel: event.channel,
        thread_ts: event.thread_ts ?? event.ts,
        text: debugContent
          ? `_${status ?? "..."}_\n\n*Debug:*\n\`\`\`\n${JSON.stringify(debugContent, null, 2)}\n\`\`\``
          : `_${status ?? "..."}_`,
      });
    } else if (status) {
      await client.chat.update({
        channel: event.channel,
        ts: assertDefined(statusMessage.ts),
        text: `_${status}_`,
      });
    }
  };

  const showResult = async (result: string) => {
    await client.chat.postMessage({
      channel: event.channel,
      thread_ts: event.thread_ts ?? event.ts,
      text: result,
    });
    if (!debug) {
      await client.chat.delete({
        channel: event.channel,
        ts: assertDefined(statusMessage.ts),
      });
    }
  };

  return { showStatus, showResult };
};
