import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { createUpdateSchema } from "drizzle-zod";
import { pick } from "lodash-es";
import { z } from "zod";
import { db } from "@/db";
import {
  activeStorageAttachments,
  activeStorageBlobs,
  companies,
  companyAdministrators,
  companyContractors,
  companyInvestors,
  companyLawyers,
  users,
} from "@/db/schema";
import { companyProcedure, createRouter } from "@/trpc";
import {
  company_administrator_stripe_microdeposit_verifications_url,
  microdeposit_verification_details_company_invoices_url,
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

  listUsersWithRoles: companyProcedure.input(z.object({ companyId: z.string() })).query(async ({ ctx }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    // Fetch all users who have any relationship with the company
    const [admins, contractors, investors, lawyers] = await Promise.all([
      db.query.companyAdministrators.findMany({
        where: eq(companyAdministrators.companyId, ctx.company.id),
        with: { user: true },
        orderBy: companyAdministrators.id, // Order by ID to match Rails primary_admin logic
      }),
      db.query.companyContractors.findMany({
        where: eq(companyContractors.companyId, ctx.company.id),
        with: { user: true },
      }),
      db.query.companyInvestors.findMany({
        where: eq(companyInvestors.companyId, ctx.company.id),
        with: { user: true },
      }),
      db.query.companyLawyers.findMany({
        where: eq(companyLawyers.companyId, ctx.company.id),
        with: { user: true },
      }),
    ]);

    // Get the primary admin (owner) - first admin by ID (matches Rails primary_admin logic)
    const primaryAdmin = admins.length > 0 ? admins[0] : null;

    // Create a map to store user relationships and roles
    const usersMap = new Map<
      bigint,
      {
        user: typeof users.$inferSelect;
        isAdmin: boolean;
        contractorRole?: string;
        isInvestor: boolean;
        isLawyer: boolean;
      }
    >();

    // Add contractors
    contractors.forEach((contractor) => {
      usersMap.set(contractor.user.id, {
        user: contractor.user,
        isAdmin: false,
        contractorRole: contractor.role,
        isInvestor: false,
        isLawyer: false,
      });
    });

    // Add investors
    investors.forEach((investor) => {
      const existing = usersMap.get(investor.user.id);
      if (existing) {
        existing.isInvestor = true;
      } else {
        usersMap.set(investor.user.id, {
          user: investor.user,
          isAdmin: false,
          isInvestor: true,
          isLawyer: false,
        });
      }
    });

    // Add lawyers
    lawyers.forEach((lawyer) => {
      const existing = usersMap.get(lawyer.user.id);
      if (existing) {
        existing.isLawyer = true;
      } else {
        usersMap.set(lawyer.user.id, {
          user: lawyer.user,
          isAdmin: false,
          isInvestor: false,
          isLawyer: true,
        });
      }
    });

    // Add admins (they override the isAdmin flag)
    admins.forEach((admin) => {
      const existing = usersMap.get(admin.user.id);
      if (existing) {
        existing.isAdmin = true;
      } else {
        usersMap.set(admin.user.id, {
          user: admin.user,
          isAdmin: true,
          isInvestor: false,
          isLawyer: false,
        });
      }
    });

    // Convert to array and format with proper role determination
    const results = Array.from(usersMap.values()).map(({ user, isAdmin, contractorRole, isInvestor, isLawyer }) => {
      // Role priority: Owner > Admin > Lawyer > Investor > Contractor
      let role: string | null = null;
      const isOwner = primaryAdmin?.userId === user.id;

      if (isAdmin) {
        role = isOwner ? "Owner" : "Admin";
      } else if (isLawyer) {
        role = "Lawyer";
      } else if (isInvestor) {
        role = "Investor";
      } else if (contractorRole) {
        role = contractorRole;
      }

      return {
        id: user.externalId,
        email: user.email,
        name: user.legalName || user.preferredName || user.email,
        isAdmin,
        role,
        isOwner,
      };
    });

    // Sort results: Owner first, then maintain original order
    return results.sort((a, b) => {
      if (a.isOwner && !b.isOwner) return -1;
      if (!a.isOwner && b.isOwner) return 1;
      return 0;
    });
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
        .extend({ logoKey: z.string().optional() }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

      await db.transaction(async (tx) => {
        await tx.update(companies).set(input).where(eq(companies.id, ctx.company.id));

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

  toggleAdminRole: companyProcedure
    .input(z.object({ companyId: z.string(), userId: z.string(), isAdmin: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

      // Find user by external_id
      const targetUser = await db.query.users.findFirst({
        where: eq(users.externalId, input.userId),
      });
      if (!targetUser) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

      const targetUserId = targetUser.id;

      if (BigInt(ctx.userId) === targetUserId && !input.isAdmin) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot remove your own admin role",
        });
      }

      const currentAdmins = await db.query.companyAdministrators.findMany({
        where: eq(companyAdministrators.companyId, ctx.company.id),
      });

      if (!input.isAdmin && currentAdmins.length === 1 && currentAdmins[0]?.userId === targetUserId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot remove the last administrator",
        });
      }

      if (input.isAdmin) {
        const existing = currentAdmins.find((admin) => admin.userId === targetUserId);
        if (!existing) {
          await db.insert(companyAdministrators).values({
            userId: targetUserId,
            companyId: ctx.company.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      } else {
        await db
          .delete(companyAdministrators)
          .where(
            and(eq(companyAdministrators.userId, targetUserId), eq(companyAdministrators.companyId, ctx.company.id)),
          );
      }
    }),
});
