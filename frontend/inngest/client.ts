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

    "email.equity-plan.signing-needed": {
      data: z.object({
        documentId: z.string(),
        companyId: z.string(),
        optionGrantId: z.string(),
      }),
    },
  }),
  middleware: [superjsonMiddleware],
});
