import { z } from "zod";
import { createRouter, protectedProcedure } from "@/trpc";
import { TRPCError } from "@trpc/server";

const invoiceSubmissionSchema = z.object({
  slackUserId: z.string(),
  invoiceDate: z.string(),
  description: z.string(),
  hoursOrAmount: z.string(),
  notes: z.string().optional(),
});

export const slackRouter = createRouter({
  submitInvoice: protectedProcedure
    .input(invoiceSubmissionSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const lineItem: any = {
          description: input.description,
        };

        const hoursOrAmount = input.hoursOrAmount.trim();
        
        if (hoursOrAmount.startsWith('$')) {
          const amount = parseFloat(hoursOrAmount.substring(1));
          if (isNaN(amount)) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Please enter a valid number for the dollar amount',
            });
          }
          lineItem.total_amount_cents = Math.round(amount * 100);
        } else {
          const hours = parseFloat(hoursOrAmount);
          if (isNaN(hours)) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Please enter a valid number for hours',
            });
          }
          lineItem.minutes = Math.round(hours * 60);
        }

        const invoicePayload = {
          invoice: {
            invoice_date: input.invoiceDate,
            notes: input.notes,
          },
          invoice_line_items: [lineItem],
        };

        const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/internal/companies/invoices`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Slack-User-Id': input.slackUserId,
          },
          body: JSON.stringify(invoicePayload),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: errorData.error_message || 'Failed to create invoice',
          });
        }

        const result = await response.json();
        return { success: true, invoice: result };
      } catch (error) {
        console.error('Error creating invoice via Slack:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create invoice',
        });
      }
    }),
});
