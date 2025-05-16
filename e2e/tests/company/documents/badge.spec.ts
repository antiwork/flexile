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
    // Create two unsigned documents that require signatures
    const doc1 = await documentsFactory.create(
      {
        companyId: company.company.id,
        name: "Document 1 Requiring Signature",
        docusealSubmissionId: 12345, // Add docusealSubmissionId
      },
      {
        signatures: [{ userId: contractorUser.id, title: "Signer" }],
        signed: false,
      },
    );

    const doc2 = await documentsFactory.create(
      {
        companyId: company.company.id,
        name: "Document 2 Requiring Signature",
        docusealSubmissionId: 12346, // Add docusealSubmissionId
      },
      {
        signatures: [{ userId: contractorUser.id, title: "Signer" }],
        signed: false,
      },
    );

    await login(page, adminUser);

    const documentsBadge = locateDocumentsBadge(page);
    await expect(documentsBadge).toBeVisible();
    await expect(documentsBadge).toContainText("2");

    // Create a document that's already signed - shouldn't affect the badge count
    await documentsFactory.create(
      {
        companyId: company.company.id,
        name: "Document Already Signed",
        docusealSubmissionId: 12347, // Add docusealSubmissionId
      },
      {
        signatures: [{ userId: contractorUser.id, title: "Signer" }],
        signed: true,
      },
    );

    await page.reload();

    // Badge should still show 2 since the third document is already signed
    await expect(documentsBadge).toBeVisible();
    await expect(documentsBadge).toContainText("2");

    // Sign one of the documents
    await documentSignaturesFactory.createSigned({
      documentId: doc1.document.id,
      userId: contractorUser.id,
    });

    await page.reload();

    // Badge should now show 1
    await expect(documentsBadge).toBeVisible();
    await expect(documentsBadge).toContainText("1");

    // Sign the last document
    await documentSignaturesFactory.createSigned({
      documentId: doc2.document.id,
      userId: contractorUser.id,
    });

    await page.reload();

    // Badge should no longer be visible
    await expect(documentsBadge).not.toBeVisible();
  });

  const locateDocumentsBadge = (page: Page) => page.getByRole("link", { name: "Documents" }).getByRole("status");
});
