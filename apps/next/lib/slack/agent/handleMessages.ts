import { formatISO, endOfWeek, startOfWeek } from "date-fns";
import { utc } from "@date-fns/utc";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { 
  companyContractors, 
  companyContractorUpdates, 
  companyContractorUpdateTasks,
  users
} from "@/db/schema";
import { slackClient } from "@/lib/slack/client";
import { generateAgentResponse } from "./generateAgentResponse";
import { request } from "@/utils/request";
import { company_invoices_path } from "@/utils/routes";

interface SlackMessage {
  text: string;
  userId: string;
  channelId: string;
  companyId: bigint;
  ts: string;
  threadTs?: string | undefined;
}

export const handleSlackMessage = async (message: SlackMessage) => {
  try {
    const userInfo = await slackClient.users.info({
      user: message.userId,
    });

    if (!userInfo.user?.profile?.email) {
      await sendSlackReply(
        message,
        "Sorry, I couldn't find your email address in your Slack profile."
      );
      return;
    }

    const user = await db.query.users.findFirst({
      where: eq(users.email, userInfo.user.profile.email),
    });
    
    if (!user) {
      await sendSlackReply(
        message,
        "Sorry, I couldn't find a user account with your Slack email."
      );
      return;
    }
    
    const contractor = await db.query.companyContractors.findFirst({
      where: eq(companyContractors.userId, user.id),
      with: {
        user: true,
      },
    });

    if (!contractor) {
      await sendSlackReply(
        message,
        "Sorry, I couldn't find your contractor account associated with this Slack email."
      );
      return;
    }

    const response = await generateAgentResponse({
      message: message.text,
      contractor,
      companyId: message.companyId,
    });

    await sendSlackReply(message, response.message);

    if (response.action) {
      await executeAction(response.action, contractor, message.companyId);
    }
  } catch (_error) {
    await sendSlackReply(
      message,
      "Sorry, I encountered an error processing your request."
    );
  }
};

const sendSlackReply = async (message: SlackMessage, text: string) => {
  await slackClient.chat.postMessage({
    channel: message.channelId,
    text,
    thread_ts: message.threadTs || message.ts,
  });
};

interface AgentAction {
  type: "UPDATE_WEEKLY" | "SUBMIT_INVOICE";
  payload: {
    content?: string | undefined;
    amount?: number | undefined; // For invoice amount in USD
    date?: string | undefined; // ISO date string
    description?: string | undefined;
  };
}

const executeAction = async (
  action: AgentAction,
  contractor: { id: bigint; user: Record<string, unknown> },
  companyId: bigint
) => {
  try {
    switch (action.type) {
      case "UPDATE_WEEKLY": {
        if (!action.payload.content) return;
        
        const periodStartsOn = formatISO(
          startOfWeek(new Date(), { in: utc }), 
          { representation: "date" }
        );
        
        const taskNames = action.payload.content
          .split(/\n|;/u)
          .map(task => task.trim())
          .filter(Boolean);
        
        await db.transaction(async (tx) => {
          const [update] = await tx
            .insert(companyContractorUpdates)
            .values({
              companyId,
              periodStartsOn,
              periodEndsOn: formatISO(endOfWeek(new Date(periodStartsOn)), { representation: "date" }),
              companyContractorId: contractor.id,
              publishedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [companyContractorUpdates.companyContractorId, companyContractorUpdates.periodStartsOn],
              set: { publishedAt: new Date() },
            })
            .returning();
          
          if (!update) throw new Error("Failed to create or update weekly update");
          
          await tx
            .delete(companyContractorUpdateTasks)
            .where(
              eq(companyContractorUpdateTasks.companyContractorUpdateId, update.id)
            );
          
          for (const [index, taskName] of taskNames.entries()) {
            await tx
              .insert(companyContractorUpdateTasks)
              .values({
                companyContractorUpdateId: update.id,
                position: index,
                name: taskName,
                completedAt: new Date(),
              });
          }
        });
        
        break;
      }
      
      case "SUBMIT_INVOICE": {
        if (!action.payload.amount) return;
        
        type WorkerRoles = { worker?: { payRateType?: string; payRateInSubunits?: number } };
        const roles: WorkerRoles | undefined = contractor.user.roles as unknown as WorkerRoles;
        const isProjectBased = roles.worker?.payRateType === "project_based";
        const invoiceDate = action.payload.date || formatISO(new Date(), { representation: "date" });
        const totalAmountInCents = Math.round(action.payload.amount * 100);
        const description = action.payload.description || (isProjectBased ? "Project work" : "Hours worked");
        
        await request({
          method: "POST",
          url: company_invoices_path(companyId),
          accept: "json",
          jsonData: {
            invoice: { invoice_date: invoiceDate },
            invoice_line_items: [
              isProjectBased
                ? { description, total_amount_cents: totalAmountInCents }
                : { description, minutes: Math.round((totalAmountInCents / (roles.worker?.payRateInSubunits || 1)) * 60) },
            ],
          },
        });
        
        break;
      }
      
      default:
    }
  } catch (_error) {
  }
};
