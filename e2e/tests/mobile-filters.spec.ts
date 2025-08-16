import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { documentsFactory } from "@test/factories/documents";
import { invoicesFactory } from "@test/factories/invoices";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";

test.describe("Mobile filters", () => {
  const mobileViewport = { width: 640, height: 800 };

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(mobileViewport);
  });

  test("administrator can filter invoices using mobile status filter buttons", async ({ page }) => {
    const { adminUser, company } = await companiesFactory.createCompletedOnboarding({
      requiredInvoiceApprovalCount: 1,
    });

    await invoicesFactory.create({ companyId: company.id, status: "received" });

    await invoicesFactory.create({
      companyId: company.id,
      status: "approved",
      invoiceApprovalsCount: 1,
    });

    // "Payment in progress" status
    await invoicesFactory.create({ companyId: company.id, status: "processing" });

    // "Payment scheduled" status
    await invoicesFactory.create({ companyId: company.id, status: "payment_pending" });

    // "Paid" status
    await invoicesFactory.create({ companyId: company.id, status: "paid" });

    // "Rejected" status
    await invoicesFactory.create({ companyId: company.id, status: "rejected" });

    // "Failed" status
    await invoicesFactory.create({ companyId: company.id, status: "failed" });

    await login(page, adminUser);
    await page.goto("/invoices");

    // Verify the header shows correctly
    await expect(page.getByRole("heading", { name: "Invoices", level: 1 })).toBeVisible();

    // Verify mobile filter buttons are visible - these should match all possible status labels from getInvoiceStatusLabel
    await expect(page.getByRole("button", { name: "All", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Awaiting approval" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Paid" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Rejected" })).toBeVisible();

    // Test filtering by "Awaiting approval"
    await page.getByRole("button", { name: "All", exact: true }).click();
    await page.getByRole("button", { name: "Awaiting approval" }).click();
    // Check that invoices with "Awaiting approval" status are visible by checking status label
    await expect(
      page
        .getByRole("cell")
        .filter({ has: page.getByText("Awaiting approval", { exact: true }) })
        .first(),
    ).toBeVisible();
    // Check that invoices with other statuses are not visible (only check a couple)
    await expect(
      page
        .getByRole("cell")
        .filter({ has: page.getByText("Approved", { exact: true }) })
        .first(),
    ).not.toBeVisible();
    await expect(
      page
        .getByRole("cell")
        .filter({ has: page.getByText("Paid", { exact: true }) })
        .first(),
    ).not.toBeVisible();
    await page.getByRole("button", { name: "All", exact: true }).click();

    // Test filtering by "Paid"
    await page.getByRole("button", { name: "Paid" }).click();
    // Check that invoices with "Paid" status are visible (use first() to handle multiple matches)
    await expect(
      page
        .getByRole("cell")
        .filter({ has: page.getByText("Paid", { exact: true }) })
        .first(),
    ).toBeVisible();
    // Check that invoices with other statuses are not visible (only check a couple)
    await expect(
      page
        .getByRole("cell")
        .filter({ has: page.getByText("Awaiting approval", { exact: true }) })
        .first(),
    ).not.toBeVisible();
    await expect(
      page
        .getByRole("cell")
        .filter({ has: page.getByText("Payment scheduled", { exact: true }) })
        .first(),
    ).not.toBeVisible();
    await page.getByRole("button", { name: "All", exact: true }).click();

    // Test filtering by "Rejected"
    await page.getByRole("button", { name: "Rejected" }).click();
    // Check that invoices with "Rejected" status are visible (use first() to handle multiple matches)
    await expect(
      page
        .getByRole("cell")
        .filter({ has: page.getByText("Rejected", { exact: true }) })
        .first(),
    ).toBeVisible();
    // Check that invoices with other statuses are not visible (only check a couple)
    await expect(
      page
        .getByRole("cell")
        .filter({ has: page.getByText("Awaiting approval", { exact: true }) })
        .first(),
    ).not.toBeVisible();
    await expect(
      page
        .getByRole("cell")
        .filter({ has: page.getByText("Failed", { exact: true }) })
        .first(),
    ).not.toBeVisible();
    await page.getByRole("button", { name: "All", exact: true }).click();

    // Test filtering by "All" again
    await page.getByRole("button", { name: "All", exact: true }).click();
    // Check that all statuses are visible in the table when "All" filter is selected
    // Only check a few representative statuses (use first() to handle multiple matches)
    await expect(
      page
        .getByRole("cell")
        .filter({ has: page.getByText("Awaiting approval", { exact: true }) })
        .first(),
    ).toBeVisible();
    await expect(
      page
        .getByRole("cell")
        .filter({ has: page.getByText("Paid", { exact: true }) })
        .first(),
    ).toBeVisible();
  });

  test("administrator can filter people using mobile status filter buttons", async ({ page }) => {
    // Setup: Create company with admin and contractors with different statuses
    const { adminUser, company } = await companiesFactory.createCompletedOnboarding();

    // Create contractors with different statuses
    // Active contractor (already started)
    const { user: activeUser } = await usersFactory.create();
    await companyContractorsFactory.create({
      companyId: company.id,
      userId: activeUser.id,
      startedAt: new Date(2020, 0, 1),
    });

    // Onboarding contractor (future start date)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30); // 30 days in the future
    const { user: onboardingUser } = await usersFactory.create();
    await companyContractorsFactory.create({
      companyId: company.id,
      userId: onboardingUser.id,
      startedAt: futureDate,
    });

    // Alumni contractor (has end date)
    const pastDate = new Date(2020, 0, 1);
    const endDate = new Date(2022, 0, 1);
    const { user: alumniUser } = await usersFactory.create();
    await companyContractorsFactory.create({
      companyId: company.id,
      userId: alumniUser.id,
      startedAt: pastDate,
      endedAt: endDate,
    });

    await login(page, adminUser);
    await page.goto("/people");

    // Verify mobile filter buttons are visible
    await expect(page.getByRole("button", { name: "All", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Active" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Onboarding" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Alumni" })).toBeVisible();

    // Test filtering by "Active"
    await page.getByRole("button", { name: "All", exact: true }).click();
    await page.getByRole("button", { name: "Active" }).click();
    await expect(
      page
        .getByRole("cell")
        .filter({ has: page.getByText("Active", { exact: true }) })
        .first(),
    ).toBeVisible();
    await expect(
      page
        .getByRole("cell")
        .filter({ has: page.getByText("Alumni", { exact: true }) })
        .first(),
    ).not.toBeVisible();
    await page.getByRole("button", { name: "All", exact: true }).click();

    // Test filtering by "Alumni"
    await page.getByRole("button", { name: "Alumni" }).click();
    await expect(
      page
        .getByRole("cell")
        .filter({ has: page.getByText("Alumni", { exact: true }) })
        .first(),
    ).toBeVisible();
    await expect(
      page
        .getByRole("cell")
        .filter({ has: page.getByText("Active", { exact: true }) })
        .first(),
    ).not.toBeVisible();
    await expect(
      page
        .getByRole("cell")
        .filter({ has: page.getByText("Onboarding", { exact: true }) })
        .first(),
    ).not.toBeVisible();

    // Test filtering by "All" again
    await page.getByRole("button", { name: "All", exact: true }).click();
    await expect(
      page
        .getByRole("cell")
        .filter({ has: page.getByText("Active", { exact: true }) })
        .first(),
    ).toBeVisible();
    await expect(
      page
        .getByRole("cell")
        .filter({ has: page.getByText("Alumni", { exact: true }) })
        .first(),
    ).toBeVisible();
  });

  test("contractor can filter documents using mobile status filter buttons", async ({ page }) => {
    // Setup: Create company, contractor and documents
    const { company } = await companiesFactory.createCompletedOnboarding();
    const { user } = await usersFactory.create();
    await companyContractorsFactory.create({ companyId: company.id, userId: user.id });

    // Create documents with different statuses using the factory

    // Signed document
    await documentsFactory.create(
      {
        name: "Signed Document",
        companyId: company.id,
      },
      {
        signatures: [{ userId: user.id, title: "Signer" }],
        signed: true, // Makes the document signed
      },
    );

    // Pending document (unsigned)
    await documentsFactory.create(
      {
        name: "Pending Document",
        companyId: company.id,
      },
      {
        signatures: [{ userId: user.id, title: "Signer" }],
        signed: false, // Makes the document pending
      },
    );

    // Draft document (no signatures needed)
    await documentsFactory.create({
      name: "Draft Document",
      companyId: company.id,
    });

    await login(page, user);
    await page.goto("/documents");

    // Verify mobile filter buttons are visible
    await expect(page.getByRole("button", { name: "All", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Signature required" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Signed" })).toBeVisible();

    // Test filtering by "Pending"
    await page.getByRole("button", { name: "All", exact: true }).click();
    await page.getByRole("button", { name: "Signature required" }).click();
    await expect(
      page
        .getByRole("cell")
        .filter({ has: page.getByText("Signature required", { exact: true }) })
        .first(),
    ).toBeVisible();
    await expect(
      page
        .getByRole("cell")
        .filter({ has: page.getByText("Signed", { exact: true }) })
        .first(),
    ).not.toBeVisible();
    await page.getByRole("button", { name: "All", exact: true }).click();

    // Test filtering by "Signed"
    await page.getByRole("button", { name: "Signed" }).click();
    await expect(
      page
        .getByRole("cell")
        .filter({ has: page.getByText("Signed", { exact: true }) })
        .first(),
    ).toBeVisible();
    await expect(
      page
        .getByRole("cell")
        .filter({ has: page.getByText("Signature required", { exact: true }) })
        .first(),
    ).not.toBeVisible();

    // Test filtering by "All" again
    await page.getByRole("button", { name: "All", exact: true }).click();
    await expect(
      page
        .getByRole("cell")
        .filter({ has: page.getByText("Pending Document", { exact: true }) })
        .first(),
    ).toBeVisible();
    await expect(
      page
        .getByRole("cell")
        .filter({ has: page.getByText("Signed Document", { exact: true }) })
        .first(),
    ).toBeVisible();
  });

  test("mobile select all and dropdown menu functionality works", async ({ page }) => {
    // Setup: Create company with admin and invoices
    const { adminUser, company } = await companiesFactory.createCompletedOnboarding({
      requiredInvoiceApprovalCount: 1,
    });

    // Create some invoices
    for (let i = 0; i < 3; i++) {
      await invoicesFactory.create({ companyId: company.id });
    }

    await login(page, adminUser);
    await page.goto("/invoices");

    // Verify mobile layout elements
    await expect(page.getByRole("button", { name: "Select all" })).toBeVisible();
    await expect(page.getByRole("button", { name: "More options" })).toBeVisible();

    // Test select all functionality
    await page.getByRole("button", { name: "Select all" }).click();
    // Check that all checkboxes are selected
    await expect(page.getByLabel("Select row").first()).toBeChecked();
    await expect(page.getByText("3 selected")).toBeVisible();

    // Click again to unselect all
    await page.getByRole("button", { name: "Unselect all" }).click();
    await expect(page.getByLabel("Select row").first()).not.toBeChecked();

    // Test dropdown menu
    await page.getByRole("button", { name: "More options" }).click();
    await expect(page.getByRole("menuitem", { name: "Download CSV" })).toBeVisible();

    // Click on Download CSV option
    await page.getByRole("menuitem", { name: "Download CSV" }).click();
    // This would normally trigger a download, but we can't easily verify that in the test
    // Instead, verify the menu closed after clicking
    await expect(page.getByRole("menuitem", { name: "Download CSV" })).not.toBeVisible();
  });
});
