import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { documentsFactory } from "@test/factories/documents";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { db } from "@test/db";
import { eq } from "drizzle-orm";
import { activeStorageAttachments, activeStorageBlobs, users } from "@/db/schema";
import { assert } from "@/utils/assert";

test.describe("Documents search functionality", () => {
  test("allows administrators to search documents by signer name", async ({ page }) => {
    const { company } = await companiesFactory.createCompletedOnboarding();
    const { user: admin } = await usersFactory.create();
    await companyAdministratorsFactory.create({
      companyId: company.id,
      userId: admin.id,
    });

    const { companyContractor: contractor1 } = await companyContractorsFactory.create({
      companyId: company.id,
      role: "Test Contractor",
    });
    const contractor1User = await db.query.users.findFirst({
      where: eq(users.id, contractor1.userId),
    });
    assert(contractor1User !== undefined);

    const { companyContractor: contractor2 } = await companyContractorsFactory.create({
      companyId: company.id,
      role: "Other Contractor",
    });
    const contractor2User = await db.query.users.findFirst({
      where: eq(users.id, contractor2.userId),
    });
    assert(contractor2User !== undefined);
    const { document: document1 } = await documentsFactory.create(
      {
        companyId: company.id,
        name: "Test Document 1",
      },
      {
        signatures: [{ userId: contractor1User.id, title: "Signer" }],
      },
    );
    const [blob] = await db
      .insert(activeStorageBlobs)
      .values({
        key: "blobkey",
        filename: "test.pdf",
        serviceName: "test",
        byteSize: 100n,
      })
      .returning();
    assert(blob !== undefined);
    await db.insert(activeStorageAttachments).values({
      recordId: document1.id,
      recordType: "Document",
      blobId: blob.id,
      name: "test.pdf",
    });

    const { document: document2 } = await documentsFactory.create(
      {
        companyId: company.id,
        name: "Test Document 2",
      },
      {
        signatures: [{ userId: contractor2User.id, title: "Signer" }],
      },
    );

    await login(page, admin);

    await page.goto("/documents");
    await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();

    await expect(page.getByRole("row").filter({ hasText: document1.name })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: document2.name })).toBeVisible();
    await expect(page.getByRole("link", { name: "Download" })).toHaveAttribute("href", "/download/blobkey/test.pdf");

    const searchInput = page.getByPlaceholder("Search by Signer...");
    await expect(searchInput).toBeVisible();

    await searchInput.fill(contractor1User.preferredName || "");

    await expect(page.getByRole("row").filter({ hasText: document1.name })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: document2.name })).not.toBeVisible();
  });
});
