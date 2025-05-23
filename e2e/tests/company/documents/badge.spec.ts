import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { documentsFactory } from "@test/factories/documents";
import { documentSignaturesFactory } from "@test/factories/documentSignatures";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";

test.describe("Document badge counter", () => {
  test("shows badge with count of documents requiring signatures", async ({ page }) => {
    const company = await companiesFactory.create();
    const adminUser = (await usersFactory.create()).user;
    const contractorUser = (await usersFactory.create()).user;
    await companyAdministratorsFactory.create({
      companyId: company.company.id,
      userId: adminUser.id,
    });
    await companyContractorsFactory.create({
      companyId: company.company.id,
      userId: contractorUser.id,
    });

    const doc1 = await documentsFactory.create(
      { companyId: company.company.id, name: "Document 1 Requiring Signature" },
      { signatures: [{ userId: adminUser.id, title: "Signer" }] },
    );

    await documentsFactory.create(
      { companyId: company.company.id, name: "Document 2 Requiring Signature" },
      { signatures: [{ userId: contractorUser.id, title: "Signer" }] },
    );
    await documentsFactory.create(
      { companyId: company.company.id, name: "Document Already Signed" },
      { signatures: [{ userId: adminUser.id, title: "Signer" }], signed: true },
    );

    await login(page, adminUser);

    const documentsBadge = page.getByRole("link", { name: "Documents" }).getByRole("status");
    await expect(documentsBadge).toContainText("1");

    await page.reload();

    await documentSignaturesFactory.createSigned({
      documentId: doc1.document.id,
      userId: adminUser.id,
    });

    await page.reload();

    await expect(documentsBadge).not.toBeVisible();
  });
});
