import { faker } from "@faker-js/faker";
import { db } from "@test/db";
import { activeStorageAttachments, activeStorageBlobs } from "@/db/schema";
import { assert } from "@/utils/assert";

export const attachmentsFactory = {
  create: async (
    overrides: Pick<typeof activeStorageAttachments.$inferInsert, "recordId" | "recordType"> &
      Partial<Omit<typeof activeStorageAttachments.$inferInsert, "recordId" | "recordType">> & {
        blobOverrides?: Partial<typeof activeStorageBlobs.$inferInsert>;
      },
  ) => {
    const { blobOverrides, ...attachmentOverrides } = overrides;

    const filename = blobOverrides?.filename ?? faker.system.fileName({ extensionCount: 1 }).replace(/\.\w+$/u, ".pdf");
    const contentType = blobOverrides?.contentType ?? "application/pdf";
    const content = `test attachment content for ${filename}`;

    const [blob] = await db
      .insert(activeStorageBlobs)
      .values({
        key: `test-${Date.now()}-${Math.random()}`,
        filename,
        contentType,
        metadata: JSON.stringify({}),
        serviceName: "local",
        byteSize: BigInt(content.length),
        checksum: faker.string.alphanumeric(32),
        ...blobOverrides,
      })
      .returning();
    assert(blob !== undefined);

    const [attachment] = await db
      .insert(activeStorageAttachments)
      .values({
        name: "attachments",
        blobId: blob.id,
        ...attachmentOverrides,
      })
      .returning();
    assert(attachment !== undefined);

    return { attachment, blob };
  },
};
