import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getBackendUrl } from "@/utils/backend";
import { createRouter, protectedProcedure } from "../";

// TODO (techdebt): Extract shared backend proxy/header handling into a reusable helper

export const paymentManagementRouter = createRouter({
  getDividendPaymentStatus: protectedProcedure
    .input(
      z.object({
        companyId: z.string(),
        dividendRoundId: z.number().int().positive(),
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
              "x-flexile-auth": `Bearer ${ctx.headers.authorization?.replace("Bearer ", "")}`,
              "X-CSRF-Token": ctx.headers["x-csrf-token"] || "",
            },
          },
        );

        if (!response.ok) {
          const errorCode = response.status === 400 || response.status === 422 ? "BAD_REQUEST" : "INTERNAL_SERVER_ERROR";
          throw new TRPCError({
            code: errorCode,
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
              "x-flexile-auth": `Bearer ${ctx.headers.authorization?.replace("Bearer ", "")}`,
              "X-CSRF-Token": ctx.headers["x-csrf-token"] || "",
            },
          },
        );

        if (!response.ok) {
          const errorCode = response.status === 400 || response.status === 422 ? "BAD_REQUEST" : "INTERNAL_SERVER_ERROR";
          throw new TRPCError({
            code: errorCode,
            message: `Failed to fetch account balances: ${response.statusText}`,
          });
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const balances = await response.json();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return balances;
      } catch (_error) {
        if (process.env.NODE_ENV !== "production") {
          return {
            stripe_balance_cents: 2_500_000,
            wise_balance_cents: 0,
            bank_balance_cents: 100_000_000,
          };
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch account balances",
        });
      }
    }),

  pullFundsFromBank: protectedProcedure
    .input(
      z.object({
        companyId: z.string(),
        amountInCents: z.number().int().positive(),
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
              "x-flexile-auth": `Bearer ${ctx.headers.authorization?.replace("Bearer ", "")}`,
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
          const errorCode = response.status === 400 || response.status === 422 ? "BAD_REQUEST" : "INTERNAL_SERVER_ERROR";
          throw new TRPCError({
            code: errorCode,
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
        amountInCents: z.number().int().positive(),
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
              "x-flexile-auth": `Bearer ${ctx.headers.authorization?.replace("Bearer ", "")}`,
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
          const errorCode = response.status === 400 || response.status === 422 ? "BAD_REQUEST" : "INTERNAL_SERVER_ERROR";
          throw new TRPCError({
            code: errorCode,
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
        dividendId: z.number().int().positive(),
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
              "x-flexile-auth": `Bearer ${ctx.headers.authorization?.replace("Bearer ", "")}`,
              "X-CSRF-Token": ctx.headers["x-csrf-token"] || "",
            },
          },
        );

        if (!response.ok) {
          const errorCode = response.status === 400 || response.status === 422 ? "BAD_REQUEST" : "INTERNAL_SERVER_ERROR";
          throw new TRPCError({
            code: errorCode,
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
        dividendRoundId: z.number().int().positive(),
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
              "x-flexile-auth": `Bearer ${ctx.headers.authorization?.replace("Bearer ", "")}`,
              "X-CSRF-Token": ctx.headers["x-csrf-token"] || "",
            },
          },
        );

        if (!response.ok) {
          const errorCode = response.status === 400 || response.status === 422 ? "BAD_REQUEST" : "INTERNAL_SERVER_ERROR";
          throw new TRPCError({
            code: errorCode,
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
        dividendId: z.number().int().positive(),
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
              "x-flexile-auth": `Bearer ${ctx.headers.authorization?.replace("Bearer ", "")}`,
              "X-CSRF-Token": ctx.headers["x-csrf-token"] || "",
            },
          },
        );

        if (!response.ok) {
          const errorCode = response.status === 400 || response.status === 422 ? "BAD_REQUEST" : "INTERNAL_SERVER_ERROR";
          throw new TRPCError({
            code: errorCode,
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
