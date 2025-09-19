import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { pick, truncate } from "lodash-es";
import { z } from "zod";
import { db } from "@/db";
import { companyUpdates } from "@/db/schema";
import { type CompanyContext, companyProcedure, createRouter, renderTiptapToText } from "@/trpc";
import { isActive } from "@/trpc/routes/contractors";
import {
  company_company_update_url,
  company_company_updates_url,
  send_test_email_company_company_update_url,
} from "@/utils/routes";

const byId = (ctx: CompanyContext, id: string) =>
  and(eq(companyUpdates.companyId, ctx.company.id), eq(companyUpdates.externalId, id));

const dataSchema = createInsertSchema(companyUpdates).pick({
  title: true,
  body: true,
});

export const companyUpdatesRouter = createRouter({
  list: companyProcedure.query(async ({ ctx }) => {
    if (!ctx.companyAdministrator && !isActive(ctx.companyContractor) && !ctx.companyInvestor)
      throw new TRPCError({ code: "FORBIDDEN" });
    const where = and(
      eq(companyUpdates.companyId, ctx.company.id),
      ctx.companyAdministrator ? undefined : isNotNull(companyUpdates.sentAt),
    );
    const rows = await db.query.companyUpdates.findMany({
      where,
      orderBy: desc(companyUpdates.createdAt),
    });
    const updates = rows.map((update) => ({
      ...pick(update, ["title", "sentAt"]),
      id: update.externalId,
      summary: truncate(renderTiptapToText(update.body), { length: 300 }),
    }));
    return { updates };
  }),
  get: companyProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    if (!ctx.companyAdministrator && !isActive(ctx.companyContractor) && !ctx.companyInvestor)
      throw new TRPCError({ code: "FORBIDDEN" });
    const update = await db.query.companyUpdates.findFirst({ where: byId(ctx, input.id) });
    if (!update) throw new TRPCError({ code: "NOT_FOUND" });

    return {
      ...pick(update, ["title", "body", "sentAt"]),

      id: update.externalId,
    };
  }),
  create: companyProcedure.input(dataSchema.required()).mutation(async ({ ctx, input }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    const response = await fetch(company_company_updates_url(ctx.company.externalId), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...ctx.headers,
      },
      body: JSON.stringify({
        company_update: {
          title: input.title,
          body: input.body,
        },
      }),
    });

    if (!response.ok) {
      const errorSchema = z.object({
        error_message: z.string().optional(),
      });
      const errorData = errorSchema.parse(await response.json().catch(() => ({})));
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: errorData.error_message || "Failed to create company update",
      });
    }

    const result = z
      .object({
        company_update: z.object({
          id: z.string(),
        }),
      })
      .parse(await response.json());

    return result.company_update.id;
  }),
  update: companyProcedure.input(dataSchema.extend({ id: z.string() })).mutation(async ({ ctx, input }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    const response = await fetch(company_company_update_url(ctx.company.externalId, input.id), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...ctx.headers,
      },
      body: JSON.stringify({
        company_update: {
          title: input.title,
          body: input.body,
        },
      }),
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const errorSchema = z.object({
        error_message: z.string().optional(),
      });
      const errorData = errorSchema.parse(await response.json().catch(() => ({})));
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: errorData.error_message || "Failed to update company update",
      });
    }

    const result = z
      .object({
        company_update: z.object({
          id: z.string(),
        }),
      })
      .parse(await response.json());

    return result.company_update.id;
  }),
  publish: companyProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    const response = await fetch(`${company_company_update_url(ctx.company.externalId, input.id)}/publish`, {
      method: "POST",
      headers: {
        ...ctx.headers,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to publish company update",
      });
    }

    const result = z
      .object({
        company_update: z.object({
          id: z.string(),
        }),
      })
      .parse(await response.json());

    return result.company_update.id;
  }),
  sendTestEmail: companyProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    const response = await fetch(send_test_email_company_company_update_url(ctx.company.externalId, input.id), {
      method: "POST",
      headers: {
        ...ctx.headers,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to send test email",
      });
    }
  }),
  delete: companyProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    const response = await fetch(company_company_update_url(ctx.company.externalId, input.id), {
      method: "DELETE",
      headers: {
        ...ctx.headers,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to delete company update",
      });
    }
  }),
});
