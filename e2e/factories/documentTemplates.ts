import { db } from "@test/db";
import { DocumentTemplateType } from "@/db/enums";
import { documentTemplates } from "@/db/schema";
import { assert } from "@/utils/assert";

export const documentTemplatesFactory = {
  create: async (overrides: Partial<typeof documentTemplates.$inferInsert> = {}) => {
    const [documentTemplate] = await db
      .insert(documentTemplates)
      .values({
        name: "Default Consulting Agreement",
        type: DocumentTemplateType.ConsultingContract,
        docusealId: 1n,
        signable: true,
        ...overrides,
      })
      .returning();
    assert(documentTemplate != null);

    return { documentTemplate };
  },
};
