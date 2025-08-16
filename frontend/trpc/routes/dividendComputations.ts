import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { companyProcedure, createRouter } from "@/trpc";
import { getBackendUrl } from "@/utils/backend";

export const dividendComputationsRouter = createRouter({
  create: companyProcedure
    .input(
      z.object({
        companyId: z.string(),
        totalAmountInUsd: z.number().positive().min(0.01, "Amount must be at least $0.01"),
        dividendsIssuanceDate: z.string().date("Invalid date format"),
        returnOfCapital: z.boolean().default(false),
        investorReleaseForm: z.boolean().default(false),
        investorDetails: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.company.equityEnabled) throw new TRPCError({ code: "FORBIDDEN" });
      if (!(ctx.companyAdministrator || ctx.companyLawyer)) throw new TRPCError({ code: "FORBIDDEN" });

      try {
        const url = `${getBackendUrl()}/internal/companies/${ctx.company.externalId}/dividend_computations`;

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-flexile-auth": `Bearer ${ctx.headers.authorization?.replace("Bearer ", "")}`,
            "X-CSRF-Token": ctx.headers["x-csrf-token"] || "",
          },
          body: JSON.stringify({
            total_amount_in_usd: input.totalAmountInUsd,
            dividends_issuance_date: input.dividendsIssuanceDate,
            return_of_capital: input.returnOfCapital,
            investor_release_form: input.investorReleaseForm,
            investor_details: input.investorDetails || "",
          }),
        });

        if (!response.ok) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const errorData = await response.json().catch(() => ({}));
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
            message: errorData.error || "Failed to create dividend computation",
          });
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const computation = await response.json();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
        return { id: computation.id };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create dividend computation",
        });
      }
    }),

  preview: companyProcedure
    .input(
      z.object({
        totalAmountInUsd: z.number().positive(),
        dividendsIssuanceDate: z.string().date(),
        returnOfCapital: z.boolean().default(false),
        investorReleaseForm: z.boolean().default(false),
        investorDetails: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.company.equityEnabled) throw new TRPCError({ code: "FORBIDDEN" });
      if (!(ctx.companyAdministrator || ctx.companyLawyer)) throw new TRPCError({ code: "FORBIDDEN" });

      try {
        const response = await fetch(
          `${getBackendUrl()}/internal/companies/${ctx.company.externalId}/dividend_computations/preview`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-flexile-auth": `Bearer ${ctx.headers.authorization?.replace("Bearer ", "")}`,
              "X-CSRF-Token": ctx.headers["x-csrf-token"] || "",
            },
            body: JSON.stringify({
              total_amount_in_usd: input.totalAmountInUsd,
              dividends_issuance_date: input.dividendsIssuanceDate,
              return_of_capital: input.returnOfCapital,
              investor_release_form: input.investorReleaseForm,
              investor_details: input.investorDetails || "",
            }),
          },
        );

        if (!response.ok) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const errorData = await response.json().catch(() => ({}));
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
            message: errorData.error || "Failed to generate preview",
          });
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return await response.json();
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate preview",
        });
      }
    }),

  get: companyProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    if (!ctx.company.equityEnabled) throw new TRPCError({ code: "FORBIDDEN" });
    if (!(ctx.companyAdministrator || ctx.companyLawyer)) throw new TRPCError({ code: "FORBIDDEN" });

    try {
      const response = await fetch(
        `${getBackendUrl()}/internal/companies/${ctx.company.externalId}/dividend_computations/${input.id}`,
        {
          method: "GET",
          headers: {
            "x-flexile-auth": `Bearer ${ctx.headers.authorization?.replace("Bearer ", "")}`,
            "X-CSRF-Token": ctx.headers["x-csrf-token"] || "",
          },
        },
      );

      if (!response.ok) {
        if (response.status === 404) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch dividend computation",
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return await response.json();
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch dividend computation",
      });
    }
  }),

  list: companyProcedure.query(async ({ ctx }) => {
    if (!ctx.company.equityEnabled) throw new TRPCError({ code: "FORBIDDEN" });
    if (!(ctx.companyAdministrator || ctx.companyLawyer)) throw new TRPCError({ code: "FORBIDDEN" });

    try {
      const response = await fetch(
        `${getBackendUrl()}/internal/companies/${ctx.company.externalId}/dividend_computations`,
        {
          method: "GET",
          headers: {
            "x-flexile-auth": `Bearer ${ctx.headers.authorization?.replace("Bearer ", "")}`,
            "X-CSRF-Token": ctx.headers["x-csrf-token"] || "",
          },
        },
      );

      if (!response.ok) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch dividend computations",
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return await response.json();
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch dividend computations",
      });
    }
  }),

  delete: companyProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    if (!ctx.company.equityEnabled) throw new TRPCError({ code: "FORBIDDEN" });
    if (!(ctx.companyAdministrator || ctx.companyLawyer)) throw new TRPCError({ code: "FORBIDDEN" });

    try {
      const response = await fetch(
        `${getBackendUrl()}/internal/companies/${ctx.company.externalId}/dividend_computations/${input.id}`,
        {
          method: "DELETE",
          headers: {
            "x-flexile-auth": `Bearer ${ctx.headers.authorization?.replace("Bearer ", "")}`,
            "X-CSRF-Token": ctx.headers["x-csrf-token"] || "",
          },
        },
      );

      if (!response.ok) {
        if (response.status === 404) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete dividend computation",
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return await response.json();
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to delete dividend computation",
      });
    }
  }),

  finalize: companyProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    if (!ctx.company.equityEnabled) throw new TRPCError({ code: "FORBIDDEN" });
    if (!(ctx.companyAdministrator || ctx.companyLawyer)) throw new TRPCError({ code: "FORBIDDEN" });

    try {
      const response = await fetch(
        `${getBackendUrl()}/internal/companies/${ctx.company.externalId}/dividend_computations/${input.id}/finalize`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-flexile-auth": `Bearer ${ctx.headers.authorization?.replace("Bearer ", "")}`,
            "X-CSRF-Token": ctx.headers["x-csrf-token"] || "",
          },
        },
      );

      if (!response.ok) {
        if (response.status === 404) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const errorData = await response.json().catch(() => ({}));
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
          message: errorData.error || "Failed to finalize dividend computation",
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return await response.json();
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to finalize dividend computation",
      });
    }
  }),
});
