import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { documentsFactory } from "@test/factories/documents";
import { documentSignaturesFactory } from "@test/factories/documentSignatures";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, type Page, test } from "@test/index";

test.describe("Document badge counter", () => {
  let company: Awaited<ReturnType<typeof companiesFactory.create>>;
  let adminUser: Awaited<ReturnType<typeof usersFactory.create>>["user"];
  let contractorUser: Awaited<ReturnType<typeof usersFactory.create>>["user"];

  test.beforeEach(async () => {
    company = await companiesFactory.create();
    adminUser = (await usersFactory.create()).user;
    contractorUser = (await usersFactory.create()).user;

    await companyAdministratorsFactory.create({
      companyId: company.company.id,
      userId: adminUser.id,
    });

    await companyContractorsFactory.create({
      companyId: company.company.id,
      userId: contractorUser.id,
    });
  });

  test("shows badge with count of documents requiring signatures", async ({ page }) => {
    const doc1 = await documentsFactory.createUnsigned(
      {
        companyId: company.company.id,
        name: "Document 1 Requiring Signature",
      },
      {
        signatures: [{ userId: contractorUser.id, title: "Signer" }],
      },
    );

    const doc2 = await documentsFactory.createUnsigned(
      {
        companyId: company.company.id,
        name: "Document 2 Requiring Signature",
      },
      {
        signatures: [{ userId: contractorUser.id, title: "Signer" }],
      },
    );

    await login(page, adminUser);

    const documentsBadge = locateDocumentsBadge(page);
    await expect(documentsBadge).toBeVisible();
    await expect(documentsBadge).toContainText("2");

    await documentsFactory.createSigned(
      {
        companyId: company.company.id,
        name: "Document Already Signed",
      },
      {
        signatures: [{ userId: contractorUser.id, title: "Signer" }],
      },
    );

    await page.reload();

    await expect(documentsBadge).toBeVisible();
    await expect(documentsBadge).toContainText("2");

    await documentSignaturesFactory.createSigned({
      documentId: doc1.document.id,
      userId: contractorUser.id,
    });

    await page.reload();

    await expect(documentsBadge).toBeVisible();
    await expect(documentsBadge).toContainText("1");

    await documentSignaturesFactory.createSigned({
      documentId: doc2.document.id,
      userId: contractorUser.id,
    });

    await page.reload();

    await expect(documentsBadge).not.toBeVisible();
  });

  const locateDocumentsBadge = (page: Page) => page.getByRole("link", { name: "Documents" }).getByRole("status");
});
