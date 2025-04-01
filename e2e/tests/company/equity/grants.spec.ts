import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { companyRolesFactory } from "@test/factories/companyRoles";
import { documentTemplatesFactory } from "@test/factories/documentTemplates";
import { equityGrantsFactory } from "@test/factories/equityGrants";
import { optionPoolsFactory } from "@test/factories/optionPools";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test, withinModal, withIsolatedBrowserSessionPage } from "@test/index";
import { desc, eq } from "drizzle-orm";
import { DocumentTemplateType } from "@/db/enums";
import { documents } from "@/db/schema";
import { assertDefined } from "@/utils/assert";

test.describe("New Contractor", () => {
  test("allows issuing equity grants", async ({ page, browser }) => {
    const { company } = await companiesFactory.create({ equityGrantsEnabled: true, conversionSharePriceUsd: "1" });
    const { user } = await usersFactory.create({ email: "flexy-bob@flexile.com" });
    await companyAdministratorsFactory.create({ companyId: company.id, userId: user.id });
    const { user: contractorUser } = await usersFactory.create();
    await companyContractorsFactory.create({
      companyId: company.id,
      userId: contractorUser.id,
    });
    const { role: projectBasedRole } = await companyRolesFactory.createProjectBased({ companyId: company.id });
    await companyContractorsFactory.createProjectBased({
      companyId: company.id,
      companyRoleId: projectBasedRole.id,
    });
    const { user: projectBasedUser } = await usersFactory.create();
    await companyContractorsFactory.createProjectBased({
      companyId: company.id,
      companyRoleId: projectBasedRole.id,
      userId: projectBasedUser.id,
    });
    await optionPoolsFactory.create({ companyId: company.id });
    await login(page, user);
    await page.getByRole("link", { name: "Equity" }).click();
    await page.getByRole("tab", { name: "Options" }).click();
    await expect(page.getByRole("link", { name: "New option grant" })).not.toBeVisible();
    await expect(
      page.getByText("To create a new option grant, you need to create an equity plan contract template first."),
    ).toBeVisible();

    await documentTemplatesFactory.create({
      companyId: company.id,
      type: DocumentTemplateType.EquityPlanContract,
    });
    await page.reload();
    await expect(page.getByText("create an equity plan contract template first")).not.toBeVisible();
    await page.getByRole("link", { name: "New option grant" }).click();
    await page.getByLabel("Recipient").selectOption(contractorUser.preferredName);
    await page.getByLabel("Number of options").fill("10");
    await page.getByLabel("Relationship to company").selectOption("Consultant");
    await page.getByRole("button", { name: "Create option grant" }).click();
    await withinModal(
      async (modal) => {
        await modal.getByRole("button", { name: "Sign now" }).click();
        await modal.getByRole("link", { name: "Type" }).click();
        await modal.getByPlaceholder("Type signature here...").fill("Admin Admin");
        await modal.getByRole("button", { name: "Sign and complete" }).click();
      },
      { page },
    );

    await expect(page.getByRole("table")).toHaveCount(2);
    let rows = page.getByRole("table").first().getByRole("row");
    await expect(rows).toHaveCount(2);
    let row = rows.nth(1);
    await expect(row).toContainText(contractorUser.legalName ?? "");
    await expect(row).toContainText("10");
    assertDefined(
      await db.query.documents.findFirst({
        where: eq(documents.companyId, company.id),
        orderBy: desc(documents.createdAt),
      }),
    );

    await page.getByRole("link", { name: "New option grant" }).click();
    await page.getByLabel("Recipient").selectOption(projectBasedUser.preferredName);
    await page.getByLabel("Number of options").fill("20");
    await page.getByLabel("Relationship to company").selectOption("Consultant");
    await page.getByRole("button", { name: "Create option grant" }).click();
    await withinModal(
      async (modal) => {
        await modal.getByRole("button", { name: "Sign now" }).click();
        await modal.getByRole("link", { name: "Type" }).click();
        await modal.getByPlaceholder("Type signature here...").fill("Admin Admin");
        await modal.getByRole("button", { name: "Sign and complete" }).click();
      },
      { page },
    );

    await expect(page.getByRole("table")).toHaveCount(2);
    rows = page.getByRole("table").first().getByRole("row");
    await expect(rows).toHaveCount(3);
    row = rows.nth(1);
    await expect(row).toContainText(projectBasedUser.legalName ?? "");
    await expect(row).toContainText("20");
    assertDefined(
      await db.query.documents.findFirst({
        where: eq(documents.companyId, company.id),
        orderBy: desc(documents.createdAt),
      }),
    );

    await withIsolatedBrowserSessionPage(
      async (isolatedPage) => {
        await login(isolatedPage, contractorUser);
        await isolatedPage.goto("/invoices");
        await expect(isolatedPage.getByText("You have an unsigned contract")).toBeVisible();
        await expect(isolatedPage.getByRole("link", { name: "New invoice" })).toHaveAttribute("inert");
        await isolatedPage.getByRole("link", { name: "Review & sign" }).click();
        await expect(isolatedPage.getByText(contractorUser.legalName ?? "")).toBeVisible();
        await isolatedPage.getByRole("button", { name: "Sign now" }).click();
        await isolatedPage.getByRole("link", { name: "Type" }).click();
        await isolatedPage.getByPlaceholder("Type signature here...").fill("Flexy Bob");
        await isolatedPage.getByRole("button", { name: "Complete" }).click();
        await expect(isolatedPage.getByRole("heading", { name: "Invoicing" })).toBeVisible();
      },
      { browser },
    );

    await withIsolatedBrowserSessionPage(
      async (isolatedPage) => {
        await login(isolatedPage, projectBasedUser);
        await isolatedPage.goto("/invoices");
        await expect(isolatedPage.getByText("You have an unsigned contract")).toBeVisible();
        await expect(isolatedPage.getByRole("link", { name: "New invoice" })).toHaveAttribute("inert");
        await isolatedPage.getByRole("link", { name: "Review & sign" }).click();
        await expect(isolatedPage.getByText(projectBasedUser.legalName ?? "")).toBeVisible();
        await isolatedPage.getByRole("button", { name: "Sign now" }).click();
        await isolatedPage.getByRole("link", { name: "Type" }).click();
        await isolatedPage.getByPlaceholder("Type signature here...").fill("Flexy Bob");
        await isolatedPage.getByRole("button", { name: "Complete" }).click();
        await expect(isolatedPage.getByRole("heading", { name: "Invoicing" })).toBeVisible();
      },
      { browser },
    );
  });

  test("allows exercising options", async ({ page }) => {
    const { company } = await companiesFactory.create({
      equityGrantsEnabled: true,
      conversionSharePriceUsd: "1",
      jsonData: { flags: ["option_exercising"] },
    });
    await companyAdministratorsFactory.create({ companyId: company.id });
    const { user } = await usersFactory.create();
    await companyContractorsFactory.create({ companyId: company.id, userId: user.id });
    const { companyInvestor } = await companyInvestorsFactory.create({ companyId: company.id, userId: user.id });
    await equityGrantsFactory.create({ companyInvestorId: companyInvestor.id, vestedShares: 100 });

    await login(page, user);
    await page.getByRole("link", { name: "Equity" }).click();
    await page.getByRole("tab", { name: "Options" }).click();
    await expect(page.getByText("You have 100 vested options available for exercise.")).toBeVisible();
    await page.getByRole("button", { name: "Exercise Options" }).click();
    await withinModal(
      async (modal) => {
        await modal.getByLabel("Options to exercise").fill("10");
        await expect(modal.getByText("Exercise cost$50")).toBeVisible();
        await expect(modal.getByText("Options valueBased on 2M valuation$1,000")).toBeVisible();
        await modal.getByRole("button", { name: "Proceed" }).click();
        await expect(modal.getByText(user.legalName ?? "")).toBeVisible();
        await modal.getByRole("button", { name: "Sign now" }).click();
        await modal.getByRole("link", { name: "Type" }).click();
        await modal.getByPlaceholder("Type signature here...").fill("Admin Admin");
        await modal.getByRole("button", { name: "Sign and complete" }).click();
      },
      { page },
    );
    await expect(page.getByText("We're awaiting a payment of $50 to exercise 10 options.")).toBeVisible();
  });
});
