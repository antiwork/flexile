import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { documentSignaturesFactory } from "@test/factories/documentSignatures";
import { usersFactory } from "@test/factories/users";
import { DocumentType } from "@/db/enums";
import { documents } from "@/db/schema";
import { assert } from "@/utils/assert";

type CreateOptions = {
  signatures: { userId: bigint; title: "Signer" | "Company Representative" }[];
  signed?: boolean;
};

export const documentsFactory = {
  create: async (
    overrides: Partial<typeof documents.$inferInsert> = {},
    options: CreateOptions = { signatures: [] },
  ) => {
    const signatories =
      options.signatures.length === 0
        ? [{ userId: (await usersFactory.create()).user.id, title: "Signer" }]
        : options.signatures;

    const [document] = await db
      .insert(documents)
      .values({
        companyId: overrides.companyId || (await companiesFactory.create()).company.id,
        name: "Consulting Agreement",
        type: DocumentType.ConsultingContract,
        year: new Date().getFullYear(),
        ...overrides,
      })
      .returning();
    assert(document !== undefined);

    if (signatories.length > 0) {
      for (const signatory of signatories) {
        await documentSignaturesFactory.create({
          ...signatory,
          documentId: document.id,
          signedAt: options.signed ? new Date() : undefined,
        });
      }
    }

    return { document };
  },

  createSigned: async (
    overrides: Partial<typeof documents.$inferInsert> = {},
    options: CreateOptions = { signatures: [], signed: true },
  ) => documentsFactory.create(overrides, options),

  createUnsigned: async (
    overrides: Partial<typeof documents.$inferInsert> = {},
    options: CreateOptions = { signatures: [], signed: false },
  ) => documentsFactory.create(overrides, options),

  createTaxDocument: async (
    overrides: Partial<typeof documents.$inferInsert> = {},
    options: CreateOptions = { signatures: [], signed: true },
  ) => {
    const { document } = await documentsFactory.create(
      {
        name: "W-9",
        ...overrides,
        type: DocumentType.TaxDocument,
      },
      options,
    );
    return { document };
  },
};
