import { randomUUID } from "crypto";
import { ObjectCannedACL, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";
import { db } from "@/db";
import { activeStorageBlobs } from "@/db/schema";
import { createRouter, protectedProcedure, s3Client } from "@/trpc";
import { assertDefined } from "@/utils/assert";

export const filesRouter = createRouter({
  createDirectUploadUrl: protectedProcedure
    .input(
      z.object({
        isPublic: z.boolean(),
        filename: z.string(),
        byteSize: z.number(),
        checksum: z.string(),
        contentType: z.string(),
      }),
    )
    .mutation(async ({ input: { isPublic, filename, byteSize, checksum, contentType } }) => {
      const bucket = assertDefined(isPublic ? process.env.S3_PUBLIC_BUCKET : process.env.S3_PRIVATE_BUCKET);

      const key = randomUUID();

      // Keeping upload logic Rails-compatible while we migrate
      await db.insert(activeStorageBlobs).values({
        key,
        filename,
        contentType,
        metadata: null,
        serviceName: isPublic ? "amazon_public" : "amazon",
        byteSize: BigInt(byteSize),
        checksum: Buffer.from(checksum, "base64").toString("hex"),
      });

      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
        ContentMD5: checksum,
        ContentLength: byteSize,
        ...(isPublic ? { ACL: ObjectCannedACL.public_read } : {}),
      });

      return {
        directUploadUrl: await getSignedUrl(s3Client, command),
        key,
      };
    }),
});
