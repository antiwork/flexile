import { EventSchemas, Inngest } from "inngest";
import { z } from "zod";
import { recipientSchema } from "@/trpc/email";
import { superjsonMiddleware } from "./middleware";

export const inngest = new Inngest({
  id: "flexile",
  schemas: new EventSchemas().fromZod({
    "quickbooks/sync-workers": {
      data: z.object({
        companyId: z.string(),
        activeWorkerIds: z.array(z.string()),
      }),
    },
    "quickbooks/sync-financial-report": {
      data: z.object({
        companyId: z.string(),
      }),
    },
    "quickbooks/sync-integration": {
      data: z.object({
        companyId: z.string(),
      }),
    },
    "company.update.published": {
      data: z.object({
        updateId: z.string(),
        recipients: z.array(recipientSchema).optional(),
      }),
    },
    "slack.message.send": {
      data: z.object({
        text: z.string(),
        username: z.string().optional(),
        channel: z.string().optional(),
      }),
    },
    "board_consent.created": {
      data: z.object({
        boardConsentId: z.bigint(),
      }),
    },
    "board_consent.lawyer_approved": {
      data: z.object({
        boardConsentId: z.bigint(),
        userId: z.bigint(),
        companyId: z.bigint(),
      }),
    },
    "board_consent.member_approved": {
      data: z.object({
        boardConsentId: z.bigint(),
      }),
    },
    "board_consent.auto_approve": {},
    "email.board_consent.lawyer_approval_needed": {
      data: z.object({
        boardConsentId: z.bigint(),
        companyId: z.bigint(),
        companyInvestorId: z.bigint(),
      }),
    },
    "email.board_consent.member_signing_needed": {
      data: z.object({
        boardConsentId: z.bigint(),
        companyId: z.bigint(),
      }),
    },
    "email.equity_plan.admin_signing_needed": {
      data: z.object({
        documentId: z.bigint(),
        companyId: z.bigint(),
        optionGrantId: z.bigint(),
      }),
    },
    "equity_allocation.lock": {
      data: z.object({
        equityAllocationId: z.bigint(),
        companyId: z.bigint(),
        userId: z.bigint(),
      }),
    },
  }),
  middleware: [superjsonMiddleware],
});
