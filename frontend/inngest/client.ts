import { EventSchemas, Inngest } from "inngest";
import { z } from "zod";
import { minBilledAmountSchema, recipientTypesSchema } from "@/types/recipientTypes";
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

    "quickbooks/sync-integration": {
      data: z.object({
        companyId: z.string(),
      }),
    },
    "company.update.published": {
      data: z.object({
        updateId: z.string(),
        recipientTypes: recipientTypesSchema.optional(),
        minBilledAmount: minBilledAmountSchema,
      }),
    },
  }),
  middleware: [superjsonMiddleware],
});
