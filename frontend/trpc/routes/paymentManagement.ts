import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getBackendUrl } from "@/utils/backend";
import { createRouter, protectedProcedure } from "../";

// TODO: Extract shared backend proxy/header handling into a reusable helper

export const paymentManagementRouter = createRouter({
  getDividendPaymentStatus: protectedProcedure
    .input(
      z.object({
        companyId: z.string(),
        dividendRoundId: z.number(),
      }),
    )
    .query(async ({ input, ctx }) => {
      if (!ctx.company) throw new TRPCError({ code: "FORBIDDEN", message: "Company not found" });

      try {
        const response = await fetch(
          `${getBackendUrl()}/internal/companies/${ctx.company.externalId}/dividend_rounds/${input.dividendRoundId}/payment_status`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${ctx.headers.authorization?.replace("Bearer ", "")}`,
              "X-CSRF-Token": ctx.headers["x-csrf-token"] || "",
              ...ctx.headers,
            },
          },
        );

        if (!response.ok) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to fetch payment status: ${response.statusText}`,
          });
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const paymentStatus = await response.json();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return paymentStatus;
      } catch (_error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch payment status",
        });
      }
    }),

  getAccountBalances: protectedProcedure
    .input(
      z.object({
        companyId: z.string(),
      }),
    )
    .query(async ({ ctx }) => {
      if (!ctx.company) throw new TRPCError({ code: "FORBIDDEN", message: "Company not found" });

      try {
        const response = await fetch(
          `${getBackendUrl()}/internal/companies/${ctx.company.externalId}/payment_accounts/balances`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${ctx.headers.authorization?.replace("Bearer ", "")}`,
              "X-CSRF-Token": ctx.headers["x-csrf-token"] || "",
              ...ctx.headers,
            },
          },
        );

        if (!response.ok) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to fetch account balances: ${response.statusText}`,
          });
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const balances = await response.json();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return balances;
      } catch (_error) {
        // Return mock data for now
        return {
          stripe_balance_cents: 2500000, // $25,000
          wise_balance_cents: 0,
          bank_balance_cents: 100000000, // $1,000,000
        };
      }
    }),

  pullFundsFromBank: protectedProcedure
    .input(
      z.object({
        companyId: z.string(),
        amountInCents: z.number(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.company) throw new TRPCError({ code: "FORBIDDEN", message: "Company not found" });

      try {
        const response = await fetch(
          `${getBackendUrl()}/internal/companies/${ctx.company.externalId}/payment_accounts/pull_funds`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${ctx.headers.authorization?.replace("Bearer ", "")}`,
              "X-CSRF-Token": ctx.headers["x-csrf-token"] || "",
              "Content-Type": "application/json",
              ...ctx.headers,
            },
            body: JSON.stringify({
              amount_in_cents: input.amountInCents,
            }),
          },
        );

        if (!response.ok) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to pull funds: ${response.statusText}`,
          });
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const result = await response.json();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return result;
      } catch (_error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to pull funds from bank",
        });
      }
    }),

  transferToWise: protectedProcedure
    .input(
      z.object({
        companyId: z.string(),
        amountInCents: z.number(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.company) throw new TRPCError({ code: "FORBIDDEN", message: "Company not found" });

      try {
        const response = await fetch(
          `${getBackendUrl()}/internal/companies/${ctx.company.externalId}/payment_accounts/transfer_to_wise`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${ctx.headers.authorization?.replace("Bearer ", "")}`,
              "X-CSRF-Token": ctx.headers["x-csrf-token"] || "",
              "Content-Type": "application/json",
              ...ctx.headers,
            },
            body: JSON.stringify({
              amount_in_cents: input.amountInCents,
            }),
          },
        );

        if (!response.ok) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to transfer to Wise: ${response.statusText}`,
          });
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const result = await response.json();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return result;
      } catch (_error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to transfer funds to Wise",
        });
      }
    }),

  markDividendReady: protectedProcedure
    .input(
      z.object({
        companyId: z.string(),
        dividendId: z.number(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.company) throw new TRPCError({ code: "FORBIDDEN", message: "Company not found" });

      try {
        const response = await fetch(
          `${getBackendUrl()}/internal/companies/${ctx.company.externalId}/dividends/${input.dividendId}/mark_ready`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${ctx.headers.authorization?.replace("Bearer ", "")}`,
              "X-CSRF-Token": ctx.headers["x-csrf-token"] || "",
              ...ctx.headers,
            },
          },
        );

        if (!response.ok) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to mark dividend ready: ${response.statusText}`,
          });
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const result = await response.json();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return result;
      } catch (_error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to mark dividend ready for payment",
        });
      }
    }),

  processReadyPayments: protectedProcedure
    .input(
      z.object({
        companyId: z.string(),
        dividendRoundId: z.number(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.company) throw new TRPCError({ code: "FORBIDDEN", message: "Company not found" });

      try {
        const response = await fetch(
          `${getBackendUrl()}/internal/companies/${ctx.company.externalId}/dividend_rounds/${input.dividendRoundId}/process_payments`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${ctx.headers.authorization?.replace("Bearer ", "")}`,
              "X-CSRF-Token": ctx.headers["x-csrf-token"] || "",
              ...ctx.headers,
            },
          },
        );

        if (!response.ok) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to process payments: ${response.statusText}`,
          });
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const result = await response.json();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return result;
      } catch (_error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to process payments",
        });
      }
    }),

  retryFailedPayment: protectedProcedure
    .input(
      z.object({
        companyId: z.string(),
        dividendId: z.number(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.company) throw new TRPCError({ code: "FORBIDDEN", message: "Company not found" });

      try {
        const response = await fetch(
          `${getBackendUrl()}/internal/companies/${ctx.company.externalId}/dividends/${input.dividendId}/retry_payment`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${ctx.headers.authorization?.replace("Bearer ", "")}`,
              "X-CSRF-Token": ctx.headers["x-csrf-token"] || "",
              ...ctx.headers,
            },
          },
        );

        if (!response.ok) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to retry payment: ${response.statusText}`,
          });
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const result = await response.json();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return result;
      } catch (_error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retry payment",
        });
      }
    }),
});
