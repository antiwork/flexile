import { db } from "@test/db";
import { documentsFactory } from "@test/factories/documents";
import { usersFactory } from "@test/factories/users";
import { eq } from "drizzle-orm";
import { documents, documentSignatures, users } from "@/db/schema";
import { assert } from "@/utils/assert";

export const documentSignaturesFactory = {
  create: async (overrides: Partial<typeof documentSignatures.$inferInsert> = {}) => {
    const user = overrides.userId
      ? ((await db.query.users.findFirst({ where: eq(users.id, overrides.userId) })) ??
        (() => {
          throw new Error(`User with id ${overrides.userId} not found`);
        })())
      : (await usersFactory.create()).user;

    const document = overrides.documentId
      ? ((await db.query.documents.findFirst({ where: eq(documents.id, overrides.documentId) })) ??
        (() => {
          throw new Error(`Document with id ${overrides.documentId} not found`);
        })())
      : (await documentsFactory.create()).document;

    const [documentSignature] = await db
      .insert(documentSignatures)
      .values({
        userId: user.id,
        documentId: document.id,
        title: "Signer",
        ...overrides,
      })
      .returning();
    assert(documentSignature !== undefined);

    return { documentSignature };
  },

  createSigned: async (overrides: Partial<typeof documentSignatures.$inferInsert> = {}) => {
    const { documentSignature } = await documentSignaturesFactory.create({
      ...overrides,
      signedAt: new Date(),
    });
    return documentSignature;
  },
};
