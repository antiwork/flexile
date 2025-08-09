import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { documents, documentSignatures } from "@/db/schema";
import { baseProcedure, companyProcedure, createRouter } from "@/trpc";

export const internalDocumentsRouter = createRouter({
  // Upload PDF and create document
  upload: companyProcedure
    .input(z.object({
      name: z.string(),
      file: z.string(), // base64 encoded PDF
      isTemplate: z.boolean().default(false),
      type: z.number(), // DocumentType enum
    }))
    .mutation(async ({ ctx, input }) => {
      const fileStorageKey = `internal-${Date.now()}-${input.name.replace(/[^a-zA-Z0-9.-]/g, '_')}.pdf`;
      
      const [document] = await db.insert(documents).values({
        companyId: ctx.company.id,
        name: input.name,
        type: input.type,
        year: new Date().getFullYear(),
        fileStorageKey,
        status: 'unsigned',
        isTemplate: input.isTemplate,
        jsonData: { base64Content: input.file }
      }).returning();

      if (!document) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create document" });

      return {
        documentId: document.id,
        fileStorageKey: document.fileStorageKey,
        status: document.status
      };
    }),

  getSigningData: companyProcedure
    .input(z.object({ documentId: z.bigint() }))
    .query(async ({ ctx, input }) => {
      const document = await db.query.documents.findFirst({
        where: and(
          eq(documents.id, input.documentId),
          eq(documents.companyId, ctx.company.id)
        ),
        with: {
          signatures: { with: { user: true } },
        },
      });

      if (!document) throw new TRPCError({ code: "NOT_FOUND" });

      const jsonData = document.jsonData as { base64Content?: string } | null;

      return {
        document,
        fileContent: jsonData?.base64Content || null,
        signatures: document.signatureData || {},
        status: document.status || 'unsigned',
      };
    }),

  createInternalSubmission: companyProcedure
    .input(z.object({
      templateId: z.bigint(),
      targetUserId: z.bigint(),
      role: z.enum(["Company Representative", "Signer"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const template = await db.query.documents.findFirst({
        where: and(
          eq(documents.id, input.templateId),
          eq(documents.isTemplate, true),
          eq(documents.companyId, ctx.company.id)
        ),
      });

      if (!template) throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });

      const [newDocument] = await db.insert(documents).values({
        companyId: ctx.company.id,
        name: `${template.name} - Signing Instance`,
        type: template.type,
        year: new Date().getFullYear(),
        fileStorageKey: template.fileStorageKey,
        status: 'unsigned',
        isTemplate: false,
        createdFromTemplateId: template.id,
        jsonData: template.jsonData,
      }).returning();

      if (!newDocument) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create document" });

      await db.insert(documentSignatures).values([
        {
          documentId: newDocument.id,
          userId: ctx.user.id,
          title: input.role,
        },
        {
          documentId: newDocument.id,
          userId: input.targetUserId,
          title: input.role === "Company Representative" ? "Signer" : "Company Representative",
        }
      ]);

      return {
        id: newDocument.id,
        document: newDocument,
      };
    }),

  // Public test endpoint (no auth required)
  publicTest: baseProcedure
    .query(async () => {
      return { message: "Internal documents system working - no auth needed!", timestamp: new Date() };
    }),
  test: companyProcedure
    .query(async ({ ctx }) => {
      return { message: "Internal documents router is working!", companyId: ctx.company.id };
    }),
});
