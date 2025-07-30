import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { DocumentTemplateType } from "@/db/enums";
import { documents, documentTemplates, users } from "@/db/schema";
import env from "@/env";
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
