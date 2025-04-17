import { AppMentionEvent, AssistantThreadStartedEvent, GenericMessageEvent, WebClient } from "@slack/web-api";
import { CoreMessage } from "ai";
import { assertDefined } from "@/components/utils/assert";
import { Company } from "@/lib/data/company";
import { SlackCompanyInfo, WHICH_COMPANY_MESSAGE } from "@/lib/slack/agent/findCompanyForEvent";
import { generateAgentResponse } from "@/lib/slack/agent/generateAgentResponse";
import { getThreadMessages } from "@/lib/slack/client";

export async function handleMessage(event: GenericMessageEvent | AppMentionEvent, companyInfo: SlackCompanyInfo) {
  if (!companyInfo.currentCompany) {
    await askWhichCompany(event, companyInfo.companies);
    return;
  }
  const company = companyInfo.currentCompany;
  if (event.bot_id || event.bot_id === company.slackBotUserId || event.bot_profile) return;

  const { thread_ts, channel } = event;
  const { showStatus, showResult } = await replyHandler(new WebClient(assertDefined(company.slackBotToken)), event);

  const messages = thread_ts
    ? await getThreadMessages(
        assertDefined(company.slackBotToken),
        channel,
        thread_ts,
        assertDefined(company.slackBotUserId),
      )
    : ([{ role: "user", content: event.text ?? "" }] satisfies CoreMessage[]);
  const result = await generateAgentResponse(messages, company, event.user, showStatus);
  showResult(result);
}

export async function handleAssistantThreadMessage(event: AssistantThreadStartedEvent, companyInfo: SlackCompanyInfo) {
  const client = new WebClient(assertDefined(companyInfo.companies[0]?.slackBotToken));
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

export const isAgentThread = async (event: GenericMessageEvent, companyInfo: SlackCompanyInfo) => {
  const company = companyInfo.companies[0];
  if (!company?.slackBotToken || !company.slackBotUserId || !event.thread_ts || event.thread_ts === event.ts) {
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
  const debug = event.text && /(?:^|\s)!debug(?:$|\s)/.test(event.text);
  const statusMessage = await client.chat.postMessage({
    channel: event.channel,
    thread_ts: event.thread_ts ?? event.ts,
    text: "_Thinking..._",
  });

  if (!statusMessage?.ts) throw new Error("Failed to post initial message");

  const showStatus = async (status: string | null, debugContent?: any) => {
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
        ts: statusMessage.ts!,
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
        ts: statusMessage.ts!,
      });
    }
  };

  return { showStatus, showResult };
};

const askWhichCompany = async (event: GenericMessageEvent | AppMentionEvent, companies: Company[]) => {
  const client = new WebClient(assertDefined(companies[0]?.slackBotToken));
  await client.chat.postMessage({
    channel: event.channel,
    thread_ts: event.thread_ts ?? event.ts,
    text: `${WHICH_COMPANY_MESSAGE} (${companies.map((c) => c.name).join("/")})`,
  });
};
