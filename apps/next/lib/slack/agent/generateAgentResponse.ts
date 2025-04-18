import { WebClient } from "@slack/web-api";
import { CoreMessage, tool } from "ai";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { companies, companyContractors, companyContractorUpdates, companyContractorUpdateTasks } from "@/db/schema";
import { runAIQuery } from "@/lib/ai/index";
import type { RouterOutput } from "@/trpc";
import { assertDefined } from "@/utils/assert";

type Company = typeof companies.$inferSelect;
type CompanyContractor = typeof companyContractors.$inferSelect;
type Update = RouterOutput["teamUpdates"]["list"][number];
type Absence = RouterOutput["workerAbsences"]["list"][number];

export const generateAgentResponse = async (
  messages: CoreMessage[],
  company: Company,
  slackUserId: string | undefined,
  showStatus?: (status: string | null, debugContent?: Record<string, unknown> | string | null) => void,
) => {
  const text = await runAIQuery({
    company,
    queryType: "agent_response",
    model: "gpt-4o",
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
    maxSteps: 10,
    tools: {
      getCurrentSlackUser: tool({
        description:
          "Get the current Slack user making the request. Crucial for actions specific to a user, like fetching their updates or submitting invoices.",
        parameters: z.object({}),
        execute: async () => {
          showStatus?.(`Checking user...`, { slackUserId });
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
        execute: async () => {
          showStatus?.(`Getting weekly update...`);
          // 1. Get current user info (needs contractorId and companyId)
          const currentUserInfo = await (this as any).getCurrentSlackUser.execute({});
          if (currentUserInfo.error || !currentUserInfo.contractorId || !currentUserInfo.companyId) {
            return { error: currentUserInfo.error || "Could not determine current user's contractor/company ID." };
          }
          const { contractorId, companyId } = currentUserInfo;

          // 2. Find the latest update for this contractor and company
          const latestUpdate = await db.query.companyContractorUpdates.findFirst({
            where: and(
              eq(companyContractorUpdates.contractorId, contractorId),
              eq(companyContractorUpdates.companyId, companyId),
            ),
            orderBy: desc(companyContractorUpdates.createdAt),
            with: {
              tasks: {
                columns: { description: true, completedAt: true },
              },
            },
          });

          if (!latestUpdate) {
            return { message: "No weekly update found for the current user." };
          }

          return {
            submittedAt: latestUpdate.createdAt,
            tasks: latestUpdate.tasks.map((task: { description: string | null; completedAt: Date | null }) => ({
              description: task.description,
              completed: !!task.completedAt,
            })),
          };
        },
      }),
      updateWeeklyUpdate: tool({
        description: "Add a task or item to the current user's latest weekly update.",
        parameters: z.object({
          taskDescription: z.string().describe("The description of the task or update item to add."),
        }),
        execute: async ({ taskDescription }) => {
          showStatus?.(`Updating weekly update...`, { taskDescription });
          // 1. Get current user info
          const currentUserInfo = await (this as any).getCurrentSlackUser.execute({});
          if (currentUserInfo.error || !currentUserInfo.contractorId || !currentUserInfo.companyId) {
            return { error: currentUserInfo.error || "Could not determine current user's contractor/company ID." };
          }
          const { contractorId, companyId } = currentUserInfo;

          // 2. Find the latest update (or potentially create one if logic dictates, assuming find for now)
          // TODO (techdebt): Decide if a new update should be created if none exists for the current period.
          const latestUpdate = await db.query.companyContractorUpdates.findFirst({
            where: and(
              eq(companyContractorUpdates.contractorId, contractorId),
              eq(companyContractorUpdates.companyId, companyId),
            ),
            orderBy: desc(companyContractorUpdates.createdAt),
            columns: { id: true },
          });

          if (!latestUpdate) {
            return { error: "No existing weekly update found to add tasks to." };
          }

          // 3. Add the new task
          await db.insert(companyContractorUpdateTasks).values({
            updateId: latestUpdate.id,
            description: taskDescription,
          });

          return { success: true, message: `Added task: "${taskDescription}" to the latest weekly update.` };
        },
      }),
    },
  });

  return text.replace(/\[(.*?)\]\((.*?)\)/gu, "<$2|$1>").replace(/\*\*/gu, "*");
};
