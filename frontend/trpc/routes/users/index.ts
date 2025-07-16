import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { DocumentTemplateType } from "@/db/enums";
import {
  companyAdministrators,
  companyContractors,
  companyLawyers,
  documents,
  documentTemplates,
  users,
} from "@/db/schema";
import env from "@/env";
import { MAX_PREFERRED_NAME_LENGTH, MIN_EMAIL_LENGTH } from "@/models";
import { createRouter, protectedProcedure } from "@/trpc";
import { sendEmail } from "@/trpc/email";
import { createSubmission } from "@/trpc/routes/documents/templates";
import { assertDefined } from "@/utils/assert";
import { settings_tax_url } from "@/utils/routes";
import { latestUserComplianceInfo, userDisplayEmail, userDisplayName, withRoles } from "./helpers";
import TaxSettingsChanged from "./TaxSettingsChanged";

export type User = typeof users.$inferSelect;
export const usersRouter = createRouter({
  get: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    let user = ctx.user;
    let hasBankAccount = false;

    if (input.id !== ctx.user.externalId) {
      if (!ctx.companyAdministrator && !ctx.companyLawyer) throw new TRPCError({ code: "FORBIDDEN" });
      const data = await db.query.users.findFirst({
        with: {
          ...withRoles(ctx.company.id),
          userComplianceInfos: latestUserComplianceInfo,
          wiseRecipients: { columns: { id: true }, limit: 1 },
        },
        where: eq(users.externalId, input.id),
      });
      if (
        !data ||
        !(["companyAdministrators", "companyLawyers", "companyContractors", "companyInvestors"] as const).some(
          (role) => data[role].length > 0,
        )
      )
        throw new TRPCError({ code: "NOT_FOUND" });
      user = data;
      hasBankAccount = data.wiseRecipients.length > 0;
    } else {
      const currentUserData = await db.query.users.findFirst({
        with: {
          userComplianceInfos: latestUserComplianceInfo,
          wiseRecipients: { columns: { id: true }, limit: 1 },
        },
        where: eq(users.id, BigInt(ctx.userId)),
      });
      if (currentUserData) {
        hasBankAccount = currentUserData.wiseRecipients.length > 0;
      }
    }

    return {
      id: user.externalId,
      email: userDisplayEmail(user),
      preferredName: user.preferredName,
      legalName: user.legalName,
      businessName: user.userComplianceInfos[0]?.businessName,
      address: getAddress(user),
      displayName: userDisplayName(user),
      hasBankAccount,
    };
  }),

  getContractorStatus: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user.id) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "User ID not found in context",
      });
    }

    if (!ctx.company?.id) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No company context found",
      });
    }

    const contractor = await db.query.companyContractors.findFirst({
      where: and(
        eq(companyContractors.userId, BigInt(ctx.user.id)),
        eq(companyContractors.companyId, ctx.company.id), // No BigInt conversion needed
        isNull(companyContractors.endedAt),
      ),
    });

    return {
      hasActiveContract: !!contractor,
      contractorData: contractor || null,
    };
  }),

  leaveWorkspace: protectedProcedure
    .input(
      z.object({
        companyId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Validate required context
      if (!ctx.user.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User ID not found in context",
        });
      }

      if (!ctx.company?.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No company context found",
        });
      }

      let targetCompanyId: bigint;

      if (input.companyId === ctx.company.externalId) {
        targetCompanyId = ctx.company.id;
      } else {
        // Try to parse as a potential numeric ID
        try {
          targetCompanyId = BigInt(input.companyId);
        } catch (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid company ID format",
          });
        }
      }

      // Validate that the target company matches the user's current company
      if (targetCompanyId !== ctx.company.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Company ID mismatch with current company context",
        });
      }

      // Check if user has contractor relationship
      const contractor = await db.query.companyContractors.findFirst({
        where: and(
          eq(companyContractors.userId, BigInt(ctx.user.id)),
          eq(companyContractors.companyId, targetCompanyId),
          isNull(companyContractors.endedAt),
        ),
      });

      if (!contractor) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No active contractor relationship found",
        });
      }

      // Check if contractor has external contract
      if (contractor.contractSignedElsewhere) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You cannot leave the workspace while having a contract signed elsewhere",
        });
      }

      try {
        await db.transaction(async (tx) => {
          const now = new Date();

          // 1. End contractor relationship
          const updatedContractor = await tx
            .update(companyContractors)
            .set({
              endedAt: now,
              updatedAt: now,
            })
            .where(
              and(
                eq(companyContractors.userId, BigInt(ctx.user.id)),
                eq(companyContractors.companyId, targetCompanyId),
                isNull(companyContractors.endedAt),
              ),
            )
            .returning();

          if (updatedContractor.length === 0) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to end contractor relationship",
            });
          }

          // 2. Remove all role-based relationships
          const roleCleanupPromises = [
            // Remove admin roles
            tx
              .delete(companyAdministrators)
              .where(
                and(
                  eq(companyAdministrators.userId, BigInt(ctx.user.id)),
                  eq(companyAdministrators.companyId, targetCompanyId),
                ),
              ),
            // Remove lawyer roles
            tx
              .delete(companyLawyers)
              .where(
                and(eq(companyLawyers.userId, BigInt(ctx.user.id)), eq(companyLawyers.companyId, targetCompanyId)),
              ),
            // Add other role cleanups as needed based on your schema
          ];

          const cleanupResults = await Promise.all(roleCleanupPromises);
        });

        return {
          success: true,
          message: "Successfully left workspace",
          leftAt: new Date().toISOString(),
          companyId: input.companyId,
        };
      } catch (error) {
        // Re-throw TRPC errors
        if (error instanceof TRPCError) {
          throw error;
        }

        // Handle other errors
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to leave workspace",
        });
      }
    }),

  update: protectedProcedure
    .input(
      z.object({
        email: z.string(),
        preferredName: z.string().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.preferredName && input.preferredName.length > MAX_PREFERRED_NAME_LENGTH) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Preferred name exceeds maximum length of ${MAX_PREFERRED_NAME_LENGTH} characters`,
        });
      }
      if (input.email.length < MIN_EMAIL_LENGTH) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Email must be at least ${MIN_EMAIL_LENGTH} characters`,
        });
      }

      await db
        .update(users)
        .set({
          email: input.email,
          preferredName: input.preferredName,
        })
        .where(eq(users.id, BigInt(ctx.userId)));
    }),

  updateTaxSettings: protectedProcedure.input(z.object({ data: z.unknown() })).mutation(async ({ ctx, input }) => {
    const response = await fetch(settings_tax_url({ host: ctx.host }), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...ctx.headers },
      body: JSON.stringify(input.data),
    });
    if (!response.ok) throw new TRPCError({ code: "BAD_REQUEST", message: await response.text() });
    const { documentIds } = z.object({ documentIds: z.array(z.number()) }).parse(await response.json());

    const createdDocuments = await db.query.documents.findMany({
      where: inArray(documents.id, documentIds.map(BigInt)),
      with: { signatures: { with: { user: true } } },
    });
    for (const document of createdDocuments) {
      // TODO store which template was used for the previous contract
      const template = await db.query.documentTemplates.findFirst({
        where: and(
          or(eq(documentTemplates.companyId, document.companyId), isNull(documentTemplates.companyId)),
          eq(documentTemplates.type, DocumentTemplateType.ConsultingContract),
        ),
        orderBy: desc(documentTemplates.createdAt),
      });
      const user = assertDefined(document.signatures.find((s) => s.title === "Company Representative")?.user);
      const submission = await createSubmission(ctx, assertDefined(template).docusealId, user, "Signer");
      await db.update(documents).set({ docusealSubmissionId: submission.id }).where(eq(documents.id, document.id));

      await sendEmail({
        from: `Flexile <support@${env.DOMAIN}>`,
        to: user.email,
        subject: `${userDisplayName(ctx.user)} has updated their tax information`,
        react: TaxSettingsChanged({
          host: ctx.host,
          name: userDisplayName(ctx.user),
          documentId: document.id,
        }),
      });
    }
    return { documentId: createdDocuments[0]?.id };
  }),

  getContractorInfo: protectedProcedure.query(({ ctx }) => {
    if (!ctx.companyContractor) return null;
    return {
      contractSignedElsewhere: ctx.companyContractor.contractSignedElsewhere,
    };
  }),
});

const getAddress = (user: User) => ({
  streetAddress: user.streetAddress,
  city: user.city,
  zipCode: user.zipCode,
  countryCode: user.countryCode,
  stateCode: user.state,
});

export * from "./helpers";
