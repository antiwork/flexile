import { TRPCError } from "@trpc/server";
import { and, count, eq, inArray } from "drizzle-orm";
import { createUpdateSchema } from "drizzle-zod";
import { pick } from "lodash-es";
import { z } from "zod";
import { db } from "@/db";
import type { WorkspaceMemberRoles } from "@/db/enums";
import { workspaceMemberRoles } from "@/db/enums";
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
  company_administrator_settings_workspace_roles_url,
  company_administrator_stripe_microdeposit_verifications_url,
  microdeposit_verification_details_company_invoices_url,
} from "@/utils/routes";

type UserWithRoleInfo = {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  isLawyer: boolean;
  role: WorkspaceMemberRoles;
  isOwner: boolean;
};

type UserWithoutRoleInfo = {
  id?: string;
  email: string;
  name: string;
  isInvestor: boolean;
  isContractor: boolean;
};

const ROLES_WHITELIST = z.enum([workspaceMemberRoles[1], workspaceMemberRoles[2]], {
  errorMap: (issue, ctx) => {
    if (issue.code === z.ZodIssueCode.invalid_enum_value) {
      return { message: "Please select a valid role" };
    }
    return { message: ctx.defaultError };
  },
});

export const addWorkspaceMemberSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  role: ROLES_WHITELIST,
});

export const workspaceMemberSchema = z.object({
  userId: z.string(),
  companyId: z.string(),
  fromAddMemberForm: z.boolean().optional(),
  role: ROLES_WHITELIST,
});

export const deleteWorkspaceMemberRoleSchema = z.object({
  userId: z.string(),
  role: ROLES_WHITELIST,
});

type WorkspaceMemberData = z.infer<typeof workspaceMemberSchema>;
type WorkspaceInvitationInput = z.infer<typeof addWorkspaceMemberSchema>;

export type InviteWorkspaceMembersBody = WorkspaceInvitationInput;
export type UpdateWorkspaceMemberRoleBody = Pick<WorkspaceMemberData, "role">;
export type RevokeWorkspaceMemberRoleBody = null;

export type WorkspaceMemberActionBody =
  | InviteWorkspaceMembersBody
  | UpdateWorkspaceMemberRoleBody
  | RevokeWorkspaceMemberRoleBody;

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

  usersWithRole: companyProcedure.input(z.object({ companyId: z.string() })).query(async ({ ctx }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    // Get role records in parallel for better performance
    const [adminRecords, lawyerRecords] = await Promise.all([
      db
        .select({
          id: companyAdministrators.id,
          userId: companyAdministrators.userId,
          createdAt: companyAdministrators.createdAt,
        })
        .from(companyAdministrators)
        .where(eq(companyAdministrators.companyId, ctx.company.id)),
      db
        .select({
          id: companyLawyers.id,
          userId: companyLawyers.userId,
          createdAt: companyLawyers.createdAt,
        })
        .from(companyLawyers)
        .where(eq(companyLawyers.companyId, ctx.company.id)),
    ]);

    const userIds = new Set<bigint>();
    adminRecords.forEach((record) => userIds.add(record.userId));
    lawyerRecords.forEach((record) => userIds.add(record.userId));

    const usersWithRawRoles = await db.query.users.findMany({
      columns: {
        id: true,
        externalId: true,
        email: true,
        legalName: true,
        preferredName: true,
        invitationToken: true,
      },
      where: (usersTable) => inArray(usersTable.id, Array.from(userIds)),
    });

    const adminMap = new Set(adminRecords.map((record) => record.userId));
    const lawyerMap = new Set(lawyerRecords.map((record) => record.userId));

    // Get the primary admin (owner) - first admin by ID (matches Rails primary_admin logic)
    // TODO (techdebt) | Strategy Required: Ownership Transfer might fail this?
    let primaryAdminUserId: bigint | null = null;
    if (adminRecords.length > 0) {
      adminRecords.sort((a, b) => {
        if (a.id < b.id) return -1;
        if (a.id > b.id) return 1;
        return 0;
      });
      primaryAdminUserId = adminRecords[0]?.userId ?? null;
    }

    const results: UserWithRoleInfo[] = usersWithRawRoles.map((user) => {
      const isAdmin = adminMap.has(user.id);
      const isLawyer = lawyerMap.has(user.id);
      const isOwner = isAdmin && user.id === primaryAdminUserId;
      const isInvited = typeof user.invitationToken === "string";

      let role: UserWithRoleInfo["role"] = "Member";
      if (isOwner) {
        role = "Owner";
      } else if (isAdmin) {
        role = "Admin";
      } else if (isLawyer) {
        role = "Lawyer";
      }

      return {
        id: user.externalId,
        email: user.email,
        name: user.legalName ?? user.preferredName ?? (isInvited ? `${user.email} (Invited)` : user.email),
        isAdmin,
        isLawyer,
        role,
        isOwner,
      };
    });

    // Owner first, then Admins by name, then Lawyers by name
    return results.sort((a, b) => {
      if (a.isOwner !== b.isOwner) return a.isOwner ? -1 : 1;
      if (a.isAdmin !== b.isAdmin) return a.isAdmin ? -1 : 1;
      if (a.isLawyer !== b.isLawyer) return a.isLawyer ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }),

  usersWithoutRole: companyProcedure
    .input(
      z.object({
        userId: z.string(),
        excludeRoledUserIds: z.array(z.string()).optional(), // Pass the user IDs from usersWithRole
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

      // Get company relationship records in parallel for better performance
      const [investorRecords, contractorRecords] = await Promise.all([
        db
          .select({
            userId: companyInvestors.userId,
          })
          .from(companyInvestors)
          .where(eq(companyInvestors.companyId, ctx.company.id)),
        db
          .select({
            userId: companyContractors.userId,
          })
          .from(companyContractors)
          .where(eq(companyContractors.companyId, ctx.company.id)),
      ]);

      // Convert excludeRoledUserIds to a Set for efficient lookup
      const excludeRoledUserIdsSet = new Set(input.excludeRoledUserIds || []);

      const companyUserIds = new Set<bigint>();
      investorRecords.forEach((record) => companyUserIds.add(record.userId));
      contractorRecords.forEach((record) => companyUserIds.add(record.userId));

      // If no company-related users exist, return empty array
      if (companyUserIds.size === 0) {
        return [];
      }

      // Get user details for company-related users
      const allCompanyUsers = await db.query.users.findMany({
        columns: {
          id: true,
          externalId: true,
          email: true,
          legalName: true,
          preferredName: true,
          invitationToken: true,
        },
        where: (usersTable) => inArray(usersTable.id, Array.from(companyUserIds)),
      });

      // Create maps for efficient type checking
      const investorMap = new Set(investorRecords.map((record) => record.userId));
      const contractorMap = new Set(contractorRecords.map((record) => record.userId));

      // Get current user ID
      const currentUser = await db.query.users.findFirst({
        where: eq(users.externalId, input.userId),
      });
      const currentUserId = currentUser?.id;

      // Filter and transform users
      const usersWithoutRole: UserWithoutRoleInfo[] = allCompanyUsers
        .filter((user) => {
          // Exclude users who already have roles (from database)
          if (excludeRoledUserIdsSet.has(user.id.toString())) return false;

          // Exclude users who already have roles (passed from frontend)
          if (excludeRoledUserIdsSet.has(user.externalId)) return false;

          // Exclude users with pending invitations
          if (user.invitationToken) return false;

          // Exclude current user
          if (currentUserId && user.id === currentUserId) return false;

          return true;
        })
        .map((user) => {
          const isInvestor = investorMap.has(user.id);
          const isContractor = contractorMap.has(user.id);
          const name = user.legalName ?? user.preferredName ?? user.email;

          return {
            id: user.externalId,
            email: user.email,
            name,
            isInvestor,
            isContractor,
          };
        });

      // Sort by name for consistent ordering
      return usersWithoutRole.sort((a, b) => a.name.localeCompare(b.name));
    }),

  inviteUserToWorkspace: companyProcedure.input(addWorkspaceMemberSchema).mutation(async ({ ctx, input }) => {
    if (!ctx.companyAdministrator) {
      throw new TRPCError({ code: "FORBIDDEN", message: "You don't have permission to invite members" });
    }

    try {
      const response = await fetch(
        company_administrator_settings_workspace_roles_url(ctx.company.externalId, { host: ctx.host }),
        {
          method: "POST",
          body: JSON.stringify(input),
          headers: { "Content-Type": "application/json", ...ctx.headers },
        },
      );

      if (!response.ok) {
        const errSchema = z.object({ error: z.string() });
        const { error } = errSchema.parse(await response.json());

        if (response.status === 403) {
          throw new TRPCError({ code: "FORBIDDEN", message: error });
        } else if (response.status === 422) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error });
        } else {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Server error occurred" });
        }
      }

      const successResponse = z
        .object({
          success: z.literal(true),
          message: z.string(),
        })
        .parse(await response.json());
      return successResponse;
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "An unexpected error occurred" });
    }
  }),

  updateWorkspaceMemberRole: companyProcedure.input(workspaceMemberSchema).mutation(async ({ ctx, input }) => {
    if (!ctx.companyAdministrator) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    const targetUser = await db.query.users.findFirst({
      where: eq(users.externalId, input.userId),
      with: {
        companyAdministrators: {
          where: eq(companyAdministrators.companyId, ctx.company.id),
        },
        companyLawyers: {
          where: eq(companyLawyers.companyId, ctx.company.id),
        },
      },
    });

    if (!targetUser) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

    const targetUserId = targetUser.id;
    const isAdmin = targetUser.companyAdministrators.length > 0;
    const isLawyer = targetUser.companyLawyers.length > 0;
    const targetRole = input.role;

    if ((isAdmin && targetRole === "Admin") || (isLawyer && targetRole === "Lawyer" && !isAdmin)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot change to the same role" });
    }

    await db.transaction(async (tx) => {
      // For user with multiple roles, we cleanup states
      if (targetRole === "Admin" || isAdmin) {
        await tx
          .delete(companyLawyers)
          .where(and(eq(companyLawyers.userId, targetUserId), eq(companyLawyers.companyId, ctx.company.id)));
      }
      if (targetRole === "Lawyer") {
        await tx
          .delete(companyAdministrators)
          .where(
            and(eq(companyAdministrators.userId, targetUserId), eq(companyAdministrators.companyId, ctx.company.id)),
          );
      }
      if (targetRole === "Admin") {
        await tx.insert(companyAdministrators).values({
          userId: targetUserId,
          companyId: ctx.company.id,
        });
      } else {
        await tx.insert(companyLawyers).values({
          userId: targetUserId,
          companyId: ctx.company.id,
        });
      }
    });
  }),

  deleteWorkspaceMemberRole: companyProcedure
    .input(z.object({ companyId: z.string(), userId: z.string(), role: ROLES_WHITELIST }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

      const targetUser = await db.query.users.findFirst({
        columns: {
          id: true,
        },
        where: eq(users.externalId, input.userId),
      });

      if (!targetUser) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

      const targetUserId = targetUser.id;

      // Check if trying to remove own role
      if (BigInt(ctx.userId) === targetUserId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot remove your own role",
        });
      }

      // Keep the original database-based admin role revocation for backward compatibility
      // Check if this would remove the last administrator
      if (input.role === "Admin") {
        const adminCount = await db
          .select({ count: count() })
          .from(companyAdministrators)
          .where(and(eq(companyAdministrators.companyId, ctx.company.id)));

        // Short circuit when no admin present
        // Owner & another admin
        if ((adminCount[0]?.count ?? 0) <= 2) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot remove the last administrator",
          });
        }
      }

      // Remove both admin and lawyer roles in a transaction
      await db.transaction(async (tx) => {
        await tx
          .delete(companyAdministrators)
          .where(
            and(eq(companyAdministrators.userId, targetUserId), eq(companyAdministrators.companyId, ctx.company.id)),
          );

        await tx
          .delete(companyLawyers)
          .where(and(eq(companyLawyers.userId, targetUserId), eq(companyLawyers.companyId, ctx.company.id)));
      });
    }),

  // --- Microdeposit Verification ---
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
});
