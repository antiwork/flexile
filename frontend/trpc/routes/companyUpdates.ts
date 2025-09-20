import { TRPCError } from "@trpc/server";
import { createInsertSchema } from "drizzle-zod";
import { truncate } from "lodash-es";
import { z } from "zod";
import { companyUpdates } from "@/db/schema";
import { companyProcedure, createRouter, renderTiptapToText } from "@/trpc";
import { isActive } from "@/trpc/routes/contractors";
import {
  company_company_update_url,
  company_company_updates_url,
  publish_company_company_update_url,
  send_test_email_company_company_update_url,
} from "@/utils/routes";

const dataSchema = createInsertSchema(companyUpdates).pick({
  title: true,
  body: true,
});

export const companyUpdatesRouter = createRouter({
  list: companyProcedure.query(async ({ ctx }) => {
    if (!ctx.companyAdministrator && !isActive(ctx.companyContractor) && !ctx.companyInvestor)
      throw new TRPCError({ code: "FORBIDDEN" });

    const response = await fetch(company_company_updates_url(ctx.company.externalId), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...ctx.headers,
      },
    });

    if (!response.ok) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch company updates",
      });
    }

    const result = z
      .object({
        updates: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            body: z.string(),
            sent_at: z.string().nullable().optional(),
            status: z.string().optional(),
          }),
        ),
        pagy: z
          .object({
            page: z.number().optional(),
            pages: z.number().optional(),
            count: z.number().optional(),
          })
          .optional(),
      })
      .parse(await response.json());

    return {
      ...result,
      updates: result.updates.map((update) => ({
        ...update,
        summary: truncate(renderTiptapToText(update.body), { length: 300 }),
        sentAt: update.sent_at,
      })),
    };
  }),
  get: companyProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    if (!ctx.companyAdministrator && !isActive(ctx.companyContractor) && !ctx.companyInvestor)
      throw new TRPCError({ code: "FORBIDDEN" });

    const response = await fetch(company_company_update_url(ctx.company.externalId, input.id), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...ctx.headers,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch company update",
      });
    }

    const result = z
      .object({
        id: z.string(),
        title: z.string(),
        sender_name: z.string().optional(),
        body: z.string(),
        status: z.string(),
        sent_at: z.string().nullable().optional(),
      })
      .parse(await response.json());

    return {
      id: result.id,
      title: result.title,
      senderName: result.sender_name,
      body: result.body,
      status: result.status,
      sentAt: result.sent_at,
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

    const response = await fetch(publish_company_company_update_url(ctx.company.externalId, input.id), {
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
