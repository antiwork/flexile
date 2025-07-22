import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { documentsFactory } from "@test/factories/documents";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { mockDocuseal } from "@test/helpers/docuseal";
import { expect, test, withinModal } from "@test/index";

test.describe("Document badge counter", () => {
  test("admin sees correct badge count and badge disappears after signing", async ({ page, next }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding();
    const contractor = (await usersFactory.create()).user;
    await companyContractorsFactory.create({ companyId: company.id, userId: contractor.id });
    await documentsFactory.create(
      { companyId: company.id, name: "Doc 1", docusealSubmissionId: 1 },
      {
        signatures: [
          { userId: adminUser.id, title: "Company Representative" },
          { userId: contractor.id, title: "Signer" },
        ],
      },
    );
    await login(page, adminUser);

    const badge = page.getByRole("link", { name: "Documents" }).getByRole("status");
    await expect(badge).toContainText("1");

    // Sign the document using the UI
    await page.getByRole("link", { name: "Documents" }).click();
    await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();
    await page.getByRole("button", { name: "Review and sign" }).first().click();

    const { mockForm } = mockDocuseal(next, {
      submitters: () => ({ "Company Representative": adminUser, Signer: contractor }),
    });
    await mockForm(page);
    await withinModal(
      async (modal) => {
        await modal.getByRole("button", { name: "Sign now" }).click();
        await modal.getByRole("link", { name: "Type" }).click();
        await modal.getByPlaceholder("Type signature here...").fill("Admin Admin");
        await modal.getByRole("button", { name: "Complete" }).click();
      },
      { page },
    );
    await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();
    await expect(badge).not.toBeVisible();
  });

  test("contractor badge updates as documents are signed (decrement and disappear)", async ({ page, next }) => {
    const { company } = await companiesFactory.createCompletedOnboarding();
    const contractor = (await usersFactory.create()).user;
    await companyContractorsFactory.create({ companyId: company.id, userId: contractor.id });
    await documentsFactory.create(
      { companyId: company.id, name: "Doc 1", docusealSubmissionId: 1 },
      { signatures: [{ userId: contractor.id, title: "Signer" }] },
    );
    await documentsFactory.create(
      { companyId: company.id, name: "Doc 2", docusealSubmissionId: 2 },
      { signatures: [{ userId: contractor.id, title: "Signer" }] },
    );

    await login(page, contractor);
    const badge = page.getByRole("link", { name: "Documents" }).getByRole("status");
    await expect(badge).toContainText("2");

    // Sign the first document using the UI
    let mockFormResult = mockDocuseal(next, {
      submitters: () => ({ Signer: contractor }),
    });
    await mockFormResult.mockForm(page);

    await page.getByRole("link", { name: "Documents" }).click();
    await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();
    await page.getByRole("button", { name: "Review and sign" }).first().click();
    await page.getByRole("button", { name: "Sign now" }).click();
    await page.getByRole("link", { name: "Type" }).click();
    await page.getByPlaceholder("Type signature here...").fill("Flexy Bob");
    await page.getByRole("button", { name: "Complete" }).click();
    await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();
    await page.reload();
    await expect(badge).toContainText("1");

    // Sign the second document using the UI
    mockFormResult = mockDocuseal(next, {
      submitters: () => ({ Signer: contractor }),
    });
    await mockFormResult.mockForm(page);
    await page.getByRole("button", { name: "Review and sign" }).first().click();
    await page.getByRole("button", { name: "Sign now" }).click();
    await page.getByRole("link", { name: "Type" }).click();
    await page.getByPlaceholder("Type signature here...").fill("Flexy Bob");
    await page.getByRole("button", { name: "Complete" }).click();
    await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();
    await expect(badge).not.toBeVisible();
  });

  test("badge does not count documents already signed or requiring other users' signatures", async ({ page }) => {
    const company = (await companiesFactory.create()).company;
    const adminUser = (await usersFactory.create()).user;
    const otherUser = (await usersFactory.create()).user;
    await companyAdministratorsFactory.create({ companyId: company.id, userId: adminUser.id });
    // Already signed doc
    await documentsFactory.create(
      { companyId: company.id, name: "Doc 1", docusealSubmissionId: 1 },
      { signatures: [{ userId: adminUser.id, title: "Signer" }], signed: true },
    );
    // Doc for other user
    await documentsFactory.create(
      { companyId: company.id, name: "Doc 2", docusealSubmissionId: 2 },
      { signatures: [{ userId: otherUser.id, title: "Signer" }] },
    );
    await login(page, adminUser);
    const badge = page.getByRole("link", { name: "Documents" }).getByRole("status");
    await expect(badge).not.toBeVisible();
  });

  test("badge updates in real time after new document is added", async ({ page }) => {
    const company = (await companiesFactory.create()).company;
    const adminUser = (await usersFactory.create()).user;
    await companyAdministratorsFactory.create({ companyId: company.id, userId: adminUser.id });
    await login(page, adminUser);
    const badge = page.getByRole("link", { name: "Documents" }).getByRole("status");
    await expect(badge).not.toBeVisible();
    // Add new signable document
    await documentsFactory.create(
      { companyId: company.id, name: "Doc 1", docusealSubmissionId: 1 },
      { signatures: [{ userId: adminUser.id, title: "Signer" }] },
    );
    await page.reload();
    await expect(badge).toContainText("1");
  });

  test("badge matches invoices badge pattern (shows '10+' if >10)", async ({ page }) => {
    const company = (await companiesFactory.create()).company;
    const adminUser = (await usersFactory.create()).user;
    await companyAdministratorsFactory.create({ companyId: company.id, userId: adminUser.id });
    // Create 11 signable documents
    for (let i = 0; i < 11; i++) {
      await documentsFactory.create(
        { companyId: company.id, name: `Doc ${i + 1}`, docusealSubmissionId: i + 1 },
        { signatures: [{ userId: adminUser.id, title: "Signer" }] },
      );
    }
    await login(page, adminUser);
    const badge = page.getByRole("link", { name: "Documents" }).getByRole("status");
    await expect(badge).toContainText("10+");
  });

  test("user with both admin and contractor roles sees correct badge count", async ({ page }) => {
    const company = (await companiesFactory.create()).company;
    const user = (await usersFactory.create()).user;
    await companyAdministratorsFactory.create({ companyId: company.id, userId: user.id });
    await companyContractorsFactory.create({ companyId: company.id, userId: user.id });
    await documentsFactory.create(
      { companyId: company.id, name: "Doc 1", docusealSubmissionId: 1 },
      { signatures: [{ userId: user.id, title: "Signer" }] },
    );
    await documentsFactory.create(
      { companyId: company.id, name: "Doc 2", docusealSubmissionId: 2 },
      { signatures: [{ userId: user.id, title: "Signer" }] },
    );
    await login(page, user);
    const badge = page.getByRole("link", { name: "Documents" }).getByRole("status");
    await expect(badge).toContainText("2");
  });
});
