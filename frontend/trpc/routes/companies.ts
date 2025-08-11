import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { createUpdateSchema } from "drizzle-zod";
import { pick } from "lodash-es";
import { z } from "zod";
import { db } from "@/db";
import { activeStorageAttachments, activeStorageBlobs, companies } from "@/db/schema";
import { companyProcedure, createRouter } from "@/trpc";
import {
  add_role_company_users_url,
  company_administrator_stripe_microdeposit_verifications_url,
  company_users_url,
  microdeposit_verification_details_company_invoices_url,
  remove_role_company_users_url,
} from "@/utils/routes";

export const companyName = (company: Pick<typeof companies.$inferSelect, "publicName" | "name">) =>
  company.publicName ?? company.name;
export const companyLogoUrl = async (id: bigint) => {
  const logo = await db.query.activeStorageAttachments.findFirst({
    where: companyLogo(id),
    with: { blob: true },
  });
  return logo?.blob ? `https://${process.env.S3_PUBLIC_BUCKET}.s3.amazonaws.com/${logo.blob.key}` : null;
};

const companyLogo = (id: bigint) =>
  and(
    eq(activeStorageAttachments.recordType, "Company"),
    eq(activeStorageAttachments.recordId, id),
    eq(activeStorageAttachments.name, "logo"),
  );

const decimalRegex = /^\d+(\.\d+)?$/u;

export const companiesRouter = createRouter({
  settings: companyProcedure.query(({ ctx }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    return pick(ctx.company, ["taxId", "brandColor", "website", "name", "phoneNumber"]);
  }),

  update: companyProcedure
    .input(
      createUpdateSchema(companies, {
        brandColor: (z) => z.regex(/^#([0-9A-F]{6})$/iu, "Invalid hex color"),
        conversionSharePriceUsd: (z) => z.regex(decimalRegex),
        sharePriceInUsd: (z) => z.regex(decimalRegex),
        fmvPerShareInUsd: (z) => z.regex(decimalRegex),
      })
        .pick({
          name: true,
          taxId: true,
          phoneNumber: true,
          streetAddress: true,
          city: true,
          state: true,
          zipCode: true,
          publicName: true,
          website: true,
          brandColor: true,
          sharePriceInUsd: true,
          fmvPerShareInUsd: true,
          conversionSharePriceUsd: true,
        })
        .extend({ logoKey: z.string().optional(), equityEnabled: z.boolean().optional() }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

      const { equityEnabled, ...rest } = input;
      await db.transaction(async (tx) => {
        if (equityEnabled !== undefined) {
          await tx
            .update(companies)
            .set({ ...rest, equityEnabled })
            .where(eq(companies.id, ctx.company.id));
        } else {
          await tx.update(companies).set(rest).where(eq(companies.id, ctx.company.id));
        }

        if (input.logoKey) {
          await tx.delete(activeStorageAttachments).where(companyLogo(ctx.company.id));
          const blob = await tx.query.activeStorageBlobs.findFirst({
            where: eq(activeStorageBlobs.key, input.logoKey),
          });
          if (!blob) throw new TRPCError({ code: "NOT_FOUND", message: "Logo not found" });
          await tx.insert(activeStorageAttachments).values({
            name: "logo",
            blobId: blob.id,
            recordType: "Company",
            recordId: ctx.company.id,
          });
        }
      });
    }),
  microdepositVerificationDetails: companyProcedure.query(async ({ ctx }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    const response = await fetch(
      microdeposit_verification_details_company_invoices_url(ctx.company.externalId, { host: ctx.host }),
      { headers: ctx.headers },
    );
    const data = z
      .object({
        details: z
          .object({
            arrival_timestamp: z.number(),
            microdeposit_type: z.enum(["descriptor_code", "amounts"]),
            bank_account_number: z.string().nullable(),
          })
          .nullable(),
      })
      .parse(await response.json());
    return { microdepositVerificationDetails: data.details };
  }),
  microdepositVerification: companyProcedure
    .input(z.object({ code: z.string() }).or(z.object({ amounts: z.array(z.number()) })))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

      const response = await fetch(
        company_administrator_stripe_microdeposit_verifications_url(ctx.company.externalId, { host: ctx.host }),
        {
          method: "POST",
          body: JSON.stringify(input),
          headers: { "Content-Type": "application/json", ...ctx.headers },
        },
      );

      if (!response.ok) {
        const { error } = z.object({ error: z.string() }).parse(await response.json());
        throw new TRPCError({ code: "BAD_REQUEST", message: error });
      }
    }),

  listCompanyUsers: companyProcedure
    .input(
      z.object({
        companyId: z.string(),
        roles: z.array(z.enum(["administrators", "lawyers"])).optional(),
      }),
    )
    .output(
      z.array(
        z.object({
          id: z.string(),
          email: z.string(),
          name: z.string(),
          isAdmin: z.boolean().optional(),
          role: z.string().optional(),
          isOwner: z.boolean().optional(),
          active: z.boolean().optional(),
          allRoles: z.array(z.string()),
        }),
      ),
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

      let url = company_users_url(ctx.company.externalId, { host: ctx.host });

      if (input.roles && input.roles.length > 0) {
        const filterParam = input.roles.join(",");
        url = company_users_url(ctx.company.externalId, { host: ctx.host, params: { filter: filterParam } });
      }

      const response = await fetch(url, {
        headers: ctx.headers,
      });

      if (!response.ok) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }

      // If no roles specified, extract all_users from the full response
      if (!input.roles || input.roles.length === 0) {
        const data = z
          .object({
            all_users: z.array(
              z.object({
                id: z.string(),
                email: z.string(),
                name: z.string(),
                allRoles: z.array(z.string()),
              }),
            ),
          })
          .parse(await response.json());

        return data.all_users;
      }
      // If roles specified, return the filtered response directly
      return z
        .array(
          z.object({
            id: z.string(),
            email: z.string(),
            name: z.string(),
            isAdmin: z.boolean().optional(),
            role: z.string().optional(),
            isOwner: z.boolean().optional(),
            active: z.boolean().optional(),
            allRoles: z.array(z.string()),
          }),
        )
        .parse(await response.json());
    }),

  addRole: companyProcedure
    .input(
      z.object({
        companyId: z.string(),
        userId: z.string(),
        role: z.enum(["admin", "lawyer"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

      const response = await fetch(add_role_company_users_url(ctx.company.externalId, { host: ctx.host }), {
        method: "POST",
        headers: { ...ctx.headers, "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: input.userId, role: input.role }),
      });

      if (!response.ok) {
        const errorData = z.object({ error: z.string() }).parse(await response.json());
        throw new TRPCError({ code: "BAD_REQUEST", message: errorData.error });
      }
    }),

  removeRole: companyProcedure
    .input(
      z.object({
        companyId: z.string(),
        userId: z.string(),
        role: z.enum(["admin", "lawyer"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

      const response = await fetch(remove_role_company_users_url(ctx.company.externalId, { host: ctx.host }), {
        method: "POST",
        headers: { ...ctx.headers, "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: input.userId, role: input.role }),
      });

      if (!response.ok) {
        const errorData = z.object({ error: z.string() }).parse(await response.json());
        throw new TRPCError({ code: "BAD_REQUEST", message: errorData.error });
      }
    }),
});
