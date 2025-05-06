import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, notInArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { activeStorageAttachments, activeStorageBlobs, capTableUploads, companies, users } from "@/db/schema";
import env from "@/env";
import { MAX_FILES_PER_CAP_TABLE_UPLOAD } from "@/models";
import { companyProcedure, createRouter, getS3Url, protectedProcedure } from "@/trpc";
import { assert } from "@/utils/assert";

const COMPLETED_STATUSES = ["completed", "canceled"] as const;

export const capTableUploadsRouter = createRouter({
  create: companyProcedure
    .input(
      z.object({
        attachmentKeys: z.array(z.string()).min(1).max(MAX_FILES_PER_CAP_TABLE_UPLOAD),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existingUpload = await db.query.capTableUploads.findFirst({
        where: and(
          eq(capTableUploads.companyId, ctx.company.id),
          notInArray(capTableUploads.status, [...COMPLETED_STATUSES]),
        ),
      });
      if (!ctx.companyAdministrator || existingUpload) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return await db.transaction(async (tx) => {
        const blobs = await Promise.all(
          input.attachmentKeys.map(async (key) => {
            const blob = await tx.query.activeStorageBlobs.findFirst({
              where: eq(activeStorageBlobs.key, key),
            });
            if (!blob) throw new TRPCError({ code: "NOT_FOUND", message: "File not found" });
            return blob;
          }),
        );

        const [upload] = await tx
          .insert(capTableUploads)
          .values({
            companyId: ctx.company.id,
            userId: ctx.user.id,
            uploadedAt: new Date(),
            status: "submitted",
          })
          .returning();

        if (!upload) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        await Promise.all(
          blobs.map((blob) =>
            tx.insert(activeStorageAttachments).values({
              name: "files",
              blobId: blob.id,
              recordType: "CapTableUpload",
              recordId: upload.id,
            }),
          ),
        );

        const messageText = [
          `New cap table upload requested by ${ctx.user.email} of ${ctx.company.name}.`,
          `View all cap table uploads at https://${ctx.host}/cap_table_uploads`,
        ].join("\n");

        const response = await fetch(`https://hooks.slack.com/services/${env.SLACK_WEBHOOK_URL}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: messageText,
            channel: env.SLACK_WEBHOOK_CHANNEL,
            username: "Cap Table Bot",
          }),
        });
        assert(response.ok);

        return upload;
      });
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user.teamMember && !ctx.company) throw new TRPCError({ code: "FORBIDDEN" });

    const uploads = await db
      .select({
        id: capTableUploads.id,
        status: capTableUploads.status,
        uploadedAt: capTableUploads.uploadedAt,
        user: {
          id: users.id,
          email: users.email,
          preferredName: users.preferredName,
          legalName: users.legalName,
        },
        companyName: companies.name,
      })
      .from(capTableUploads)
      .innerJoin(users, eq(users.id, capTableUploads.userId))
      .innerJoin(companies, eq(companies.id, capTableUploads.companyId))
      .where(
        and(
          ctx.company ? eq(capTableUploads.companyId, ctx.company.id) : undefined,
          notInArray(capTableUploads.status, [...COMPLETED_STATUSES]),
        ),
      )
      .orderBy(desc(capTableUploads.createdAt));

    const attachmentRows = await db.query.activeStorageAttachments.findMany({
      where: and(
        eq(activeStorageAttachments.recordType, "CapTableUpload"),
        inArray(
          activeStorageAttachments.recordId,
          uploads.map((upload) => upload.id),
        ),
        eq(activeStorageAttachments.name, "files"),
      ),
      with: { blob: { columns: { key: true, filename: true } } },
    });

    const attachmentsByRecordId = new Map<bigint, { url: string; filename: string }[]>();
    await Promise.all(
      attachmentRows.map(async (attachment) => {
        const url = await getS3Url(attachment.blob.key, attachment.blob.filename);
        const attachmentData = {
          url,
          filename: attachment.blob.filename,
        };

        const existing = attachmentsByRecordId.get(attachment.recordId) || [];
        attachmentsByRecordId.set(attachment.recordId, [...existing, attachmentData]);
      }),
    );

    return {
      uploads: uploads.map((upload) => ({
        ...upload,
        attachments: attachmentsByRecordId.get(upload.id) || [],
      })),
    };
  }),
});
