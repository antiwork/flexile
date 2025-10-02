import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { documentsFactory } from "@test/factories/documents";
import { shareHoldingsFactory } from "@test/factories/shareHoldings";
import { usersFactory } from "@test/factories/users";
import { selectComboboxOption } from "@test/helpers";
import { login, logout } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { eq } from "drizzle-orm";
import { DocumentType } from "@/db/enums";
import { activeStorageAttachments, activeStorageBlobs, users } from "@/db/schema";
import { assert } from "@/utils/assert";

test.describe("Documents", () => {
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
      { companyId: company.id },
      { signatures: [{ userId: contractor1User.id, title: "Signer" }] },
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

    await documentsFactory.create(
      { companyId: company.id, type: DocumentType.EquityPlanContract },
      { signatures: [{ userId: contractor2User.id, title: "Signer" }] },
    );

    await login(page, admin, "/documents");

    await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();

    await page.getByRole("row").filter({ hasText: "Consulting agreement" }).click({ button: "right" });
    await expect(page.getByRole("menuitem", { name: "Download" })).toHaveAttribute(
      "href",
      "/download/blobkey/test.pdf",
    );
    await expect(page.getByRole("row").filter({ hasText: "Equity plan" })).toBeVisible();

    const searchInput = page.getByPlaceholder("Search by Signer...");
    await expect(searchInput).toBeVisible();

    await searchInput.fill(contractor1User.preferredName || "");

    await expect(page.getByRole("row").filter({ hasText: "Consulting agreement" })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: "Equity plan" })).not.toBeVisible();
  });

  test("allows administrators to share documents", async ({ page }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding();
    await documentsFactory.create({ companyId: company.id, text: "Test document text" });
    const { user: recipient } = await usersFactory.create({ legalName: "Recipient 1" });
    await companyContractorsFactory.create({ companyId: company.id, userId: recipient.id });
    await login(page, adminUser, "/documents");
    await logout(page);
    await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await page.getByRole("row").filter({ hasText: "Consulting agreement" }).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Share" }).click();
    await expect(page.locator("[contenteditable='true']")).toHaveText("Test document text");
    await page.locator("[contenteditable='true']").fill("Some other text");
    await selectComboboxOption(page, "Recipient", "Recipient 1");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.locator("tbody tr")).toHaveCount(2);

    await logout(page);
    await login(page, recipient, "/documents");
    await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await page.getByRole("button", { name: "Review and sign" }).click();
    await expect(page.getByText("Some other text")).toBeVisible();
    await page.getByRole("button", { name: "Add your signature" }).click();
    await page.getByRole("button", { name: "Agree & Submit" }).click();
  });

  test("shows the correct names for documents", async ({ page }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding();
    await documentsFactory.create({ companyId: company.id, type: DocumentType.EquityPlanContract });
    const shareHolding = await shareHoldingsFactory.create();
    await documentsFactory.create({
      companyId: company.id,
      type: DocumentType.ShareCertificate,
      shareHoldingId: shareHolding.id,
    });
    await login(page, adminUser, "/documents");
    await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();
    await page.locator("main").getByRole("button", { name: "Filter" }).click();
    await page.getByRole("menuitem", { name: "Status" }).click();
    await page.getByRole("menuitemcheckbox", { name: "All" }).click();
    await expect(page.locator("tbody tr")).toHaveCount(2);
    await expect(page.getByText("Equity incentive plan 2025")).toBeVisible();
    await expect(page.getByText(`${shareHolding.name} share certificate`)).toBeVisible();
  });
});
