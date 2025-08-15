import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { companyProcedure, createRouter } from "@/trpc";

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
      })
    )
    .mutation(async ({ ctx, input }) => {
      console.log("dividendComputations.create called with input:", input);
      console.log("ctx.company:", ctx.company);
      console.log("ctx.companyAdministrator:", !!ctx.companyAdministrator);
      console.log("ctx.companyLawyer:", !!ctx.companyLawyer);
      
      if (!ctx.company.equityEnabled) throw new TRPCError({ code: "FORBIDDEN" });
      if (!(ctx.companyAdministrator || ctx.companyLawyer)) throw new TRPCError({ code: "FORBIDDEN" });

      try {
        const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:5001";
        const url = `${backendUrl}/internal/companies/${ctx.company.externalId}/dividend_computations`;
        
        console.log("🔵 About to fetch Rails backend at:", url);
        console.log("🔵 Request headers:", {
          "Content-Type": "application/json",
          "x-flexile-auth": `Bearer ${ctx.headers.authorization?.replace("Bearer ", "")}`,
          "X-CSRF-Token": ctx.headers["x-csrf-token"] || "",
        });
        console.log("🔵 Request body:", {
          total_amount_in_usd: input.totalAmountInUsd,
          dividends_issuance_date: input.dividendsIssuanceDate,
          return_of_capital: input.returnOfCapital,
          investor_release_form: input.investorReleaseForm,
          investor_details: input.investorDetails || "",
        });
        
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

        console.log("🔵 Rails response status:", response.status);
        console.log("🔵 Rails response headers:", Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new TRPCError({ 
            code: "INTERNAL_SERVER_ERROR", 
            message: errorData.error || "Failed to create dividend computation" 
          });
        }

        const computation = await response.json();
        return { id: computation.id };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ 
          code: "INTERNAL_SERVER_ERROR", 
          message: "Failed to create dividend computation" 
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
      })
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.company.equityEnabled) throw new TRPCError({ code: "FORBIDDEN" });
      if (!(ctx.companyAdministrator || ctx.companyLawyer)) throw new TRPCError({ code: "FORBIDDEN" });

      try {
        const response = await fetch(`${process.env.BACKEND_URL}/internal/companies/${ctx.company.externalId}/dividend_computations/preview`, {
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
          const errorData = await response.json().catch(() => ({}));
          throw new TRPCError({ 
            code: "INTERNAL_SERVER_ERROR", 
            message: errorData.error || "Failed to generate preview" 
          });
        }

        return await response.json();
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ 
          code: "INTERNAL_SERVER_ERROR", 
          message: "Failed to generate preview" 
        });
      }
    }),

  get: companyProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.company.equityEnabled) throw new TRPCError({ code: "FORBIDDEN" });
      if (!(ctx.companyAdministrator || ctx.companyLawyer)) throw new TRPCError({ code: "FORBIDDEN" });

      try {
        const response = await fetch(`${process.env.BACKEND_URL}/internal/companies/${ctx.company.externalId}/dividend_computations/${input.id}`, {
          method: "GET",
          headers: {
            "x-flexile-auth": `Bearer ${ctx.headers.authorization?.replace("Bearer ", "")}`,
            "X-CSRF-Token": ctx.headers["x-csrf-token"] || "",
          },
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new TRPCError({ code: "NOT_FOUND" });
          }
          throw new TRPCError({ 
            code: "INTERNAL_SERVER_ERROR", 
            message: "Failed to fetch dividend computation" 
          });
        }

        return await response.json();
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ 
          code: "INTERNAL_SERVER_ERROR", 
          message: "Failed to fetch dividend computation" 
        });
      }
    }),

  list: companyProcedure.query(async ({ ctx }) => {
    if (!ctx.company.equityEnabled) throw new TRPCError({ code: "FORBIDDEN" });
    if (!(ctx.companyAdministrator || ctx.companyLawyer)) throw new TRPCError({ code: "FORBIDDEN" });

    try {
      const response = await fetch(`${process.env.BACKEND_URL}/internal/companies/${ctx.company.externalId}/dividend_computations`, {
        method: "GET",
        headers: {
          "x-flexile-auth": `Bearer ${ctx.headers.authorization?.replace("Bearer ", "")}`,
          "X-CSRF-Token": ctx.headers["x-csrf-token"] || "",
        },
      });

      if (!response.ok) {
        throw new TRPCError({ 
          code: "INTERNAL_SERVER_ERROR", 
          message: "Failed to fetch dividend computations" 
        });
      }

      return await response.json();
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ 
        code: "INTERNAL_SERVER_ERROR", 
        message: "Failed to fetch dividend computations" 
      });
    }
  }),

  delete: companyProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.company.equityEnabled) throw new TRPCError({ code: "FORBIDDEN" });
      if (!(ctx.companyAdministrator || ctx.companyLawyer)) throw new TRPCError({ code: "FORBIDDEN" });

      try {
        const response = await fetch(`${process.env.BACKEND_URL}/internal/companies/${ctx.company.externalId}/dividend_computations/${input.id}`, {
          method: "DELETE",
          headers: {
            "x-flexile-auth": `Bearer ${ctx.headers.authorization?.replace("Bearer ", "")}`,
            "X-CSRF-Token": ctx.headers["x-csrf-token"] || "",
          },
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new TRPCError({ code: "NOT_FOUND" });
          }
          throw new TRPCError({ 
            code: "INTERNAL_SERVER_ERROR", 
            message: "Failed to delete dividend computation" 
          });
        }

        return await response.json();
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ 
          code: "INTERNAL_SERVER_ERROR", 
          message: "Failed to delete dividend computation" 
        });
      }
    }),

  finalize: companyProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.company.equityEnabled) throw new TRPCError({ code: "FORBIDDEN" });
      if (!(ctx.companyAdministrator || ctx.companyLawyer)) throw new TRPCError({ code: "FORBIDDEN" });

      try {
        const response = await fetch(`${process.env.BACKEND_URL}/internal/companies/${ctx.company.externalId}/dividend_computations/${input.id}/finalize`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-flexile-auth": `Bearer ${ctx.headers.authorization?.replace("Bearer ", "")}`,
            "X-CSRF-Token": ctx.headers["x-csrf-token"] || "",
          },
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new TRPCError({ code: "NOT_FOUND" });
          }
          const errorData = await response.json().catch(() => ({}));
          throw new TRPCError({ 
            code: "INTERNAL_SERVER_ERROR", 
            message: errorData.error || "Failed to finalize dividend computation" 
          });
        }

        return await response.json();
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ 
          code: "INTERNAL_SERVER_ERROR", 
          message: "Failed to finalize dividend computation" 
        });
      }
    }),
});