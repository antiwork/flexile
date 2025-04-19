import { openai } from "@ai-sdk/openai";
import { WebClient } from "@slack/web-api";
import { CoreMessage, generateText, tool } from "ai";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { companies, companyContractors, companyContractorUpdates, companyContractorUpdateTasks } from "@/db/schema";
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

// Expose tool functions on 'this' for internal references
interface ToolContext {
  getCurrentSlackUser: {
    execute: (params: Record<string, never>) => Promise<UserResult>;
  };
}

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
- When providing information (e.g., weekly updates, invoice status), present it clearly.

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
      getWeeklyUpdate: tool({
        description: "Get the latest weekly update submitted by the current user.",
        parameters: z.object({}), // Implicitly uses the current user
        async execute(this: ToolContext) {
          await showStatus(`Getting weekly update...`);
          // 1. Get current user info (needs contractorId and companyId)
          const currentUserInfo = await this.getCurrentSlackUser.execute({});
          if ("error" in currentUserInfo) {
            return { error: currentUserInfo.error };
          }
          const { contractorId, companyId } = currentUserInfo;

          // 2. Find the latest update for this contractor and company
          const latestUpdate = await db.query.companyContractorUpdates.findFirst({
            where: and(
              eq(companyContractorUpdates.companyContractorId, contractorId),
              eq(companyContractorUpdates.companyId, companyId),
            ),
            orderBy: desc(companyContractorUpdates.createdAt),
            with: {
              tasks: {
                columns: { name: true, completedAt: true },
              },
            },
          });

          if (!latestUpdate) {
            return { message: "No weekly update found for the current user." };
          }

          return {
            submittedAt: latestUpdate.createdAt,
            tasks: latestUpdate.tasks.map((task: { name: string | null; completedAt: Date | null }) => ({
              name: task.name,
              completed: !!task.completedAt,
            })),
          };
        },
      }),
      updateWeeklyUpdate: tool({
        description: "Add a task or item to the current user's latest weekly update.",
        parameters: z.object({
          taskName: z.string().describe("The name of the task or update item to add."),
        }),
        async execute(this: ToolContext, { taskName }) {
          await showStatus(`Updating weekly update...`, { taskName });
          // 1. Get current user info
          const currentUserInfo = await this.getCurrentSlackUser.execute({});
          if ("error" in currentUserInfo) {
            return { error: currentUserInfo.error };
          }
          const { contractorId, companyId } = currentUserInfo;

          // 2. Find the latest update (or potentially create one if logic dictates, assuming find for now)
          // TODO (techdebt): Decide if a new update should be created if none exists for the current period.
          const latestUpdate = await db.query.companyContractorUpdates.findFirst({
            where: and(
              eq(companyContractorUpdates.companyContractorId, contractorId),
              eq(companyContractorUpdates.companyId, companyId),
            ),
            with: {
              tasks: true,
            },
            orderBy: desc(companyContractorUpdates.createdAt),
            columns: { id: true },
          });

          if (!latestUpdate) {
            return { error: "No existing weekly update found to add tasks to." };
          }

          // 3. Add the new task
          await db.insert(companyContractorUpdateTasks).values({
            companyContractorUpdateId: latestUpdate.id,
            name: taskName,
            position: latestUpdate.tasks.length,
          });

          return { success: true, message: `Added task: "${taskName}" to the latest weekly update.` };
        },
      }),
    },
  });

  return result.text.replace(/\[(.*?)\]\((.*?)\)/gu, "<$2|$1>").replace(/\*\*/gu, "*");
};
