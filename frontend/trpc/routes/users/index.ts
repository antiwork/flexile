import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { DocumentTemplateType } from "@/db/enums";
import {
  companyAdministrators,
  companyContractors,
  companyInvestors,
  companyLawyers,
  documents,
  documentTemplates,
  users,
} from "@/db/schema";
import env from "@/env";
import { MAX_PREFERRED_NAME_LENGTH, MIN_EMAIL_LENGTH } from "@/models";
import { companyProcedure, createRouter, protectedProcedure } from "@/trpc";
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

  leaveCompany: companyProcedure.input(z.object({ companyId: z.string() })).mutation(async ({ ctx, input }) => {
    if (!ctx.company) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No company context found.",
      });
    }
    if (input.companyId !== ctx.company.externalId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "You can only leave your current workspace.",
      });
    }

    const companyId = ctx.company.id;
    const userId = BigInt(ctx.userId);

    await db.transaction(async (tx) => {
      const isAdmin = await tx.query.companyAdministrators.findFirst({
        where: and(eq(companyAdministrators.userId, userId), eq(companyAdministrators.companyId, companyId)),
      });

      if (isAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Administrators cannot leave a company.",
        });
      }

      const contractor = await tx.query.companyContractors.findFirst({
        where: and(eq(companyContractors.userId, userId), eq(companyContractors.companyId, companyId)),
      });

      if (!contractor) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This action is only available to contractors.",
        });
      }

      if (contractor.contractSignedElsewhere) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You cannot leave the workspace because you have a contract signed elsewhere.",
        });
      }

      const now = new Date();
      const hasActiveContract = contractor.startedAt <= now && (!contractor.endedAt || contractor.endedAt > now);

      if (hasActiveContract) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You cannot leave the workspace with an active contract.",
        });
      }

      await Promise.all([
        tx
          .delete(companyContractors)
          .where(and(eq(companyContractors.userId, userId), eq(companyContractors.companyId, companyId))),
        tx
          .delete(companyInvestors)
          .where(and(eq(companyInvestors.userId, userId), eq(companyInvestors.companyId, companyId))),
        tx
          .delete(companyLawyers)
          .where(and(eq(companyLawyers.userId, userId), eq(companyLawyers.companyId, companyId))),
      ]);
    });

    return { success: true };
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

  getContractorStatus: companyProcedure
    .input(z.object({ companyId: z.string() }))
    .query(async ({ ctx, input }) => {
      if (input.companyId !== ctx.company.externalId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You can only get the contractor status for your current workspace.",
        });
      }

      const companyId = ctx.company.id;
      const userId = BigInt(ctx.userId);

      const contractor = await db.query.companyContractors.findFirst({
        where: and(eq(companyContractors.userId, userId), eq(companyContractors.companyId, companyId)),
        columns: {
          contractSignedElsewhere: true,
          startedAt: true,
          endedAt: true,
        },
      });

      if (!contractor) {
        return { isContractor: false, contractSignedElsewhere: false, hasActiveContract: false };
      }

      const now = new Date();
      const hasActiveContract = contractor.startedAt <= now && (!contractor.endedAt || contractor.endedAt > now);

      return {
        isContractor: true,
        contractSignedElsewhere: contractor.contractSignedElsewhere,
        hasActiveContract,
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
