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

    await invoicesFactory.create({ companyId: company.id, status: "processing" });

    await invoicesFactory.create({ companyId: company.id, status: "payment_pending" });

    await invoicesFactory.create({ companyId: company.id, status: "paid" });

    await invoicesFactory.create({ companyId: company.id, status: "rejected" });

    await invoicesFactory.create({ companyId: company.id, status: "failed" });

    await login(page, adminUser);
    await page.goto("/invoices");

    await expect(page.getByRole("heading", { name: "Invoices", level: 1 })).toBeVisible();

    await expect(page.getByRole("button", { name: "All", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Awaiting approval" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Paid" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Rejected" })).toBeVisible();

    await page.getByRole("button", { name: "All", exact: true }).click();
    await page.getByRole("button", { name: "Awaiting approval" }).click();
    await expect(
      page
        .getByRole("cell")
        .filter({ has: page.getByText("Awaiting approval", { exact: true }) })
        .first(),
    ).toBeVisible();
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

    await page.getByRole("button", { name: "Paid" }).click();
    await expect(
      page
        .getByRole("cell")
        .filter({ has: page.getByText("Paid", { exact: true }) })
        .first(),
    ).toBeVisible();
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

    await page.getByRole("button", { name: "Rejected" }).click();
    await expect(
      page
        .getByRole("cell")
        .filter({ has: page.getByText("Rejected", { exact: true }) })
        .first(),
    ).toBeVisible();
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

    await page.getByRole("button", { name: "All", exact: true }).click();
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
    const { adminUser, company } = await companiesFactory.createCompletedOnboarding();

    const { user: activeUser } = await usersFactory.create();
    await companyContractorsFactory.create({
      companyId: company.id,
      userId: activeUser.id,
      startedAt: new Date(2020, 0, 1),
    });

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const { user: onboardingUser } = await usersFactory.create();
    await companyContractorsFactory.create({
      companyId: company.id,
      userId: onboardingUser.id,
      startedAt: futureDate,
    });

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

    await expect(page.getByRole("button", { name: "All", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Active" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Onboarding" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Alumni" })).toBeVisible();

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
    const { company } = await companiesFactory.createCompletedOnboarding();
    const { user } = await usersFactory.create();
    await companyContractorsFactory.create({ companyId: company.id, userId: user.id });

    await documentsFactory.create(
      {
        name: "Signed Document",
        companyId: company.id,
      },
      {
        signatures: [{ userId: user.id, title: "Signer" }],
        signed: true,
      },
    );

    await documentsFactory.create(
      {
        name: "Pending Document",
        companyId: company.id,
      },
      {
        signatures: [{ userId: user.id, title: "Signer" }],
        signed: false,
      },
    );

    await documentsFactory.create({
      name: "Draft Document",
      companyId: company.id,
    });

    await login(page, user);
    await page.goto("/documents");

    await expect(page.getByRole("button", { name: "All", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Signature required" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Signed" })).toBeVisible();

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
    const { adminUser, company } = await companiesFactory.createCompletedOnboarding({
      requiredInvoiceApprovalCount: 1,
    });

    for (let i = 0; i < 3; i++) {
      await invoicesFactory.create({ companyId: company.id });
    }

    await login(page, adminUser);
    await page.goto("/invoices");
    await expect(page.getByRole("button", { name: "Select all" })).toBeVisible();
    await expect(page.getByRole("button", { name: "More options" })).toBeVisible();

    await page.getByRole("button", { name: "Select all" }).click();
    await expect(page.getByLabel("Select row").first()).toBeChecked();
    await expect(page.getByText("3 selected")).toBeVisible();

    await page.getByRole("button", { name: "Unselect all" }).click();
    await expect(page.getByLabel("Select row").first()).not.toBeChecked();

    await page.getByRole("button", { name: "More options" }).click();
    await expect(page.getByRole("menuitem", { name: "Download CSV" })).toBeVisible();

    await page.getByRole("menuitem", { name: "Download CSV" }).click();
    await expect(page.getByRole("menuitem", { name: "Download CSV" })).not.toBeVisible();
  });
});
