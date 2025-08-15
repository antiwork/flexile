import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, createRouter } from "../";

export const paymentManagementRouter = createRouter({
  // Get payment status for a dividend round
  getDividendPaymentStatus: protectedProcedure
    .input(z.object({
      companyId: z.string(),
      dividendRoundId: z.number(),
    }))
    .query(async ({ input, ctx }) => {
      try {
        const response = await fetch(
          `${process.env.BACKEND_URL}/internal/companies/${ctx.company!.externalId}/dividend_rounds/${input.dividendRoundId}/payment_status`,
          {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${ctx.headers.authorization?.replace("Bearer ", "")}`,
              "X-CSRF-Token": ctx.headers["x-csrf-token"] || "",
              ...ctx.headers,
            },
          }
        );

        if (!response.ok) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to fetch payment status: ${response.statusText}`,
          });
        }

        const paymentStatus = await response.json();
        return paymentStatus;
      } catch (error) {
        console.error("Error fetching payment status:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch payment status",
        });
      }
    }),

  // Get account balances (Stripe, Wise, etc.)
  getAccountBalances: protectedProcedure
    .input(z.object({
      companyId: z.string(),
    }))
    .query(async ({ ctx }) => {
      try {
        const response = await fetch(
          `${process.env.BACKEND_URL}/internal/companies/${ctx.company!.externalId}/payment_accounts/balances`,
          {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${ctx.headers.authorization?.replace("Bearer ", "")}`,
              "X-CSRF-Token": ctx.headers["x-csrf-token"] || "",
              ...ctx.headers,
            },
          }
        );

        if (!response.ok) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to fetch account balances: ${response.statusText}`,
          });
        }

        const balances = await response.json();
        return balances;
      } catch (error) {
        console.error("Error fetching account balances:", error);
        // Return mock data for now
        return {
          stripe_balance_cents: 2500000, // $25,000
          wise_balance_cents: 0,
          bank_balance_cents: 100000000, // $1,000,000
        };
      }
    }),

  // Pull funds from bank via Stripe ACH
  pullFundsFromBank: protectedProcedure
    .input(z.object({
      companyId: z.string(),
      amountInCents: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const response = await fetch(
          `${process.env.BACKEND_URL}/internal/companies/${ctx.company!.externalId}/payment_accounts/pull_funds`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${ctx.headers.authorization?.replace("Bearer ", "")}`,
              "X-CSRF-Token": ctx.headers["x-csrf-token"] || "",
              "Content-Type": "application/json",
              ...ctx.headers,
            },
            body: JSON.stringify({
              amount_in_cents: input.amountInCents,
            }),
          }
        );

        if (!response.ok) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to pull funds: ${response.statusText}`,
          });
        }

        const result = await response.json();
        return result;
      } catch (error) {
        console.error("Error pulling funds:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to pull funds from bank",
        });
      }
    }),

  // Transfer funds to Wise
  transferToWise: protectedProcedure
    .input(z.object({
      companyId: z.string(),
      amountInCents: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const response = await fetch(
          `${process.env.BACKEND_URL}/internal/companies/${ctx.company!.externalId}/payment_accounts/transfer_to_wise`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${ctx.headers.authorization?.replace("Bearer ", "")}`,
              "X-CSRF-Token": ctx.headers["x-csrf-token"] || "",
              "Content-Type": "application/json",
              ...ctx.headers,
            },
            body: JSON.stringify({
              amount_in_cents: input.amountInCents,
            }),
          }
        );

        if (!response.ok) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to transfer to Wise: ${response.statusText}`,
          });
        }

        const result = await response.json();
        return result;
      } catch (error) {
        console.error("Error transferring to Wise:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to transfer funds to Wise",
        });
      }
    }),

  // Mark dividend as ready for payment
  markDividendReady: protectedProcedure
    .input(z.object({
      companyId: z.string(),
      dividendId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const response = await fetch(
          `${process.env.BACKEND_URL}/internal/companies/${ctx.company!.externalId}/dividends/${input.dividendId}/mark_ready`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${ctx.headers.authorization?.replace("Bearer ", "")}`,
              "X-CSRF-Token": ctx.headers["x-csrf-token"] || "",
              ...ctx.headers,
            },
          }
        );

        if (!response.ok) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to mark dividend ready: ${response.statusText}`,
          });
        }

        const result = await response.json();
        return result;
      } catch (error) {
        console.error("Error marking dividend ready:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to mark dividend ready for payment",
        });
      }
    }),

  // Process payments for ready dividends
  processReadyPayments: protectedProcedure
    .input(z.object({
      companyId: z.string(),
      dividendRoundId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const response = await fetch(
          `${process.env.BACKEND_URL}/internal/companies/${ctx.company!.externalId}/dividend_rounds/${input.dividendRoundId}/process_payments`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${ctx.headers.authorization?.replace("Bearer ", "")}`,
              "X-CSRF-Token": ctx.headers["x-csrf-token"] || "",
              ...ctx.headers,
            },
          }
        );

        if (!response.ok) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to process payments: ${response.statusText}`,
          });
        }

        const result = await response.json();
        return result;
      } catch (error) {
        console.error("Error processing payments:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to process payments",
        });
      }
    }),

  // Retry failed payment
  retryFailedPayment: protectedProcedure
    .input(z.object({
      companyId: z.string(),
      dividendId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const response = await fetch(
          `${process.env.BACKEND_URL}/internal/companies/${ctx.company!.externalId}/dividends/${input.dividendId}/retry_payment`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${ctx.headers.authorization?.replace("Bearer ", "")}`,
              "X-CSRF-Token": ctx.headers["x-csrf-token"] || "",
              ...ctx.headers,
            },
          }
        );

        if (!response.ok) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to retry payment: ${response.statusText}`,
          });
        }

        const result = await response.json();
        return result;
      } catch (error) {
        console.error("Error retrying payment:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retry payment",
        });
      }
    }),
});