import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { documentsFactory } from "@test/factories/documents";
import { documentSignaturesFactory } from "@test/factories/documentSignatures";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { eq } from "drizzle-orm";
import { documents } from "@/db/schema";

test.describe("Document badge counter", () => {
  test("shows badge with count of documents requiring signatures", async ({ page }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding();
    const otherAdmin = (await usersFactory.create()).user;
    const contractorUser = (await usersFactory.create()).user;
    await companyAdministratorsFactory.create({
      companyId: company.id,
      userId: otherAdmin.id,
    });
    await companyContractorsFactory.create({
      companyId: company.id,
      userId: contractorUser.id,
    });

    const { document: doc1 } = await documentsFactory.create(
      { companyId: company.id, name: "Document 1 Requiring Signature" },
      { signatures: [{ userId: adminUser.id, title: "Company Representative" }] },
    );

    const { document: doc2 } = await documentsFactory.create(
      { companyId: company.id, name: "Document 2 Requiring Signature" },
      { signatures: [{ userId: otherAdmin.id, title: "Company Representative" }] },
    );

    await documentsFactory.create(
      { companyId: company.id, name: "Document 3 Requiring Signature" },
      { signatures: [{ userId: contractorUser.id, title: "Signer" }] },
    );
    await documentsFactory.create(
      { companyId: company.id, name: "Document Already Signed" },
      { signatures: [{ userId: otherAdmin.id, title: "Company Representative" }], signed: true },
    );

    await login(page, adminUser);

    const documentsBadge = page.getByRole("link", { name: "Documents" }).getByRole("status");
    await expect(documentsBadge).toContainText("2");

    await page.reload();

    await documentSignaturesFactory.createSigned({
      documentId: doc1.id,
      userId: otherAdmin.id,
    });
    await db.update(documents).set({ deletedAt: new Date() }).where(eq(documents.id, doc2.id));

    await page.reload();

    await expect(documentsBadge).not.toBeVisible();
  });
});
