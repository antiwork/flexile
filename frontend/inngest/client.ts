import { EventSchemas, Inngest } from "inngest";
import { z } from "zod";
import { recipientSchema } from "@/trpc/email";
import { superjsonMiddleware } from "./middleware";

export const inngest = new Inngest({
  id: "flexile",
  schemas: new EventSchemas().fromZod({
    "company.update.published": {
      data: z.object({
        updateId: z.string(),
        recipients: z.array(recipientSchema).optional(),
      }),
    },
  }),
  middleware: [superjsonMiddleware],
});
