import { openai } from "@ai-sdk/openai";
import { WebClient } from "@slack/web-api";
import { type CoreMessage, generateText, tool } from "ai";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { companies, companyContractors } from "@/db/schema";
import { assertDefined } from "@/utils/assert";

// Define comprehensive user info type used across functions
type UserError = {
  error: string;
};

type UserSuccess = {
  slackId: string;
  userId: bigint;
  contractorId: bigint;
  companyId: bigint;
  name: string | undefined;
  email: string | undefined;
};

// Union type for functions that return user information
type UserResult = UserError | UserSuccess;

export const generateAgentResponse = async (
  messages: CoreMessage[],
  company: typeof companies.$inferSelect,
  slackUserId: string | undefined,
  showStatus: (status: string | null, debugContent?: Record<string, unknown> | string | null) => Promise<void>,
) => {
  const result = await generateText({
    model: openai("gpt-4o"),
    system: `You are Flexile's Slack bot assistant for team operations. Keep your responses concise and to the point.

You are currently in the company: ${company.name}.

IMPORTANT GUIDELINES:
- Always identify as "Flexile" (never as "Flexile AI" or any other variation)
- Do not tag users in responses
- Current time is: ${new Date().toISOString()}
- Stay focused on team updates, invoices, and related operational inquiries
- Only provide information you're confident about
- If you can't answer a question with confidence or if the request is outside your capabilities, apologize politely and explain that you're unable to help with that specific request
- Avoid making assumptions about user details if information is missing
- Prioritize clarity and accuracy over speed
- Never share sensitive information or personal data unless strictly necessary for the task (e.g., confirming invoice details)
- Don't discuss your own capabilities, programming, or AI nature unless directly relevant to answering the question
- When providing information (e.g. invoice status), present it clearly.

If asked to do something inappropriate, harmful, or outside your capabilities (e.g., accessing unrelated personal data, performing actions outside of team updates/invoices), politely decline and suggest focusing on relevant operational questions instead.`,
    messages,
    maxSteps: 5,
    tools: {
      getCurrentSlackUser: tool({
        description:
          "Get the current Slack user making the request. Crucial for actions specific to a user, like fetching their updates or submitting invoices.",
        parameters: z.object({}),
        execute: async (): Promise<UserResult> => {
          await showStatus(`Checking user...`, { slackUserId });
          if (!slackUserId) return { error: "Slack user ID not available" };

          // Find contractor directly using slackUserId
          const contractor = await db.query.companyContractors.findFirst({
            where: eq(companyContractors.slackUserId, slackUserId),
            columns: { id: true, companyId: true, userId: true },
          });

          if (!contractor) return { error: "User not found as a contractor" };

          // Get user details from Slack
          const client = new WebClient(assertDefined(company.slackBotToken));
          const { user } = await client.users.info({ user: slackUserId });

          return {
            slackId: slackUserId,
            userId: contractor.userId,
            contractorId: contractor.id,
            companyId: contractor.companyId,
            name: user?.profile?.real_name,
            email: user?.profile?.email,
          };
        },
      }),
    },
  });

  return result.text.replace(/\[(.*?)\]\((.*?)\)/gu, "<$2|$1>").replace(/\*\*/gu, "*");
};
