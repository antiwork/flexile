import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { mockDocuseal } from "@test/helpers/docuseal";
import { expect, test, type Page } from "@test/index";
import { eq } from "drizzle-orm";
import { companyContractors, companyRoles } from "@/db/schema";
import { assertDefined } from "@/utils/assert";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import { PayRateType } from "@/db/enums";

test.describe("Company roles", () => {
  const setupTest = async (page: Page) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding();
    await login(page, adminUser);
    await page.getByRole("link", { name: "Roles" }).click();
    await page.getByRole("button", { name: "New role" }).click();
    return { company };
  };

  const fetchRole = async (companyId: bigint) => {
    const role = assertDefined(
      await db.query.companyRoles.findFirst({
        where: eq(companyRoles.companyId, companyId),
        with: { rates: true },
      }),
    );
    return { role, rate: assertDefined(role.rates[0]) };
  };

  test("allows updating roles", async ({ page, sentEmails, next }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding();
    const { user: contractorUser } = await usersFactory.create();
    const { mockForm } = mockDocuseal(next, {
      submitters: () => ({ "Company Representative": adminUser, Signer: contractorUser }),
    });
    await mockForm(page);
    let { companyContractor } = await companyContractorsFactory.create({
      companyId: company.id,
      userId: contractorUser.id,
    });
    let { role, rate } = await fetchRole(company.id);

    await login(page, adminUser);
    await page.getByRole("link", { name: "Roles" }).click();
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(page.locator("tbody tr > td")).toHaveText(
      [
        role.name,
        `${formatMoneyFromCents(rate.payRateInSubunits ?? 0)} / hr`,
        "0 candidates",
        "Not hiring",
        "Copy link\nEdit",
      ],
      { useInnerText: true },
    );
    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Name").fill("Role 1");
    await page.getByLabel("Rate", { exact: true }).fill("1000");
    expect(await page.getByLabel("Update rate for all contractors with this role").isChecked()).toBe(false);
    await expect(page.getByText("1 contractor has a different rate that won't be updated")).toBeVisible();
    await page.getByLabel("Job description").fill("Job description");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.locator("tbody tr > td")).toHaveText(
      ["Role 1", `${formatMoneyFromCents(100000)} / hr`, "0 candidates", "Not hiring", "Copy link\nEdit"],
      { useInnerText: true },
    );
    ({ role, rate } = await fetchRole(company.id));
    expect(role).toMatchObject({ name: "Role 1", jobDescription: "<p>Job description</p>" });
    expect(rate).toMatchObject({ payRateInSubunits: 100000 });
    expect(sentEmails).toHaveLength(0);

    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Update rate for all contractors with this role").check();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Update rates for 1 contractor to match role rate?")).toBeVisible();
    await expect(page.getByText(`${contractorUser.preferredName}$60 $1,000 (1,566.67%)`)).toBeVisible();
    await page.getByRole("button", { name: "Yes, change" }).click();
    await expect(page.getByText("Edit role")).not.toBeVisible();
    ({ role, rate } = await fetchRole(company.id));
    expect(role).toMatchObject({ name: "Role 1", jobDescription: "<p>Job description</p>" });
    expect(rate).toMatchObject({ payRateInSubunits: 100000 });
    companyContractor = assertDefined(
      await db.query.companyContractors.findFirst({ where: eq(companyContractors.id, companyContractor.id) }),
    );
    expect(companyContractor).toMatchObject({ payRateInSubunits: 100000 });
    expect(sentEmails).toEqual([
      expect.objectContaining({
        to: contractorUser.email,
        subject: "Your rate has changed!",
        text: expect.stringContaining("Your rate has changed!Old rate$60/hrNew rate$1,000/hr"),
      }),
    ]);
  });

  test("allows creating an hourly role", async ({ page }) => {
    const { company } = await setupTest(page);

    await page.getByLabel("Name").fill("Software Engineer");
    await page.getByText("Hourly").click();
    await page.getByLabel("Rate", { exact: true }).fill("100");
    await page.getByRole("button", { name: "Create", exact: true }).click();

    // Wait for the modal to close, indicating successful creation
    await expect(page.getByRole("dialog")).not.toBeVisible();

    let { role, rate } = await fetchRole(company.id);
    expect(role.name).toBe("Software Engineer");
    expect(rate.payRateInSubunits).toBe(10000);
    expect(rate.payRateType).toBe(PayRateType.Hourly);
  });

  test.describe("project-based roles", () => {
    test("with default rate", async ({ page }) => {
      const { company } = await setupTest(page);

      await page.getByLabel("Name").fill("Project Manager");
      await page.getByText("Custom").click();
      await page.getByLabel("Specify a default amount").click();
      await page.getByLabel("Amount", { exact: true }).fill("5000");
      await page.getByRole("button", { name: "Create", exact: true }).click();

      await expect(page.getByRole("dialog")).not.toBeVisible();
      await expect(page.locator("tbody tr")).toHaveCount(1);
      await expect(page.locator("tbody tr > td")).toHaveText(
        ["Project Manager", "$5,000/ project", "0 candidates", "Not hiring", "Copy link\nEdit"],
        { useInnerText: true },
      );

      let { role, rate } = await fetchRole(company.id);
      expect(role.name).toBe("Project Manager");
      expect(rate.payRateInSubunits).toBe(500000);
      expect(rate.payRateType).toBe(PayRateType.ProjectBased);
      expect(rate.unitOfWork).toBe("project");
    });

    test("with custom unit of work", async ({ page }) => {
      const { company } = await setupTest(page);

      await page.getByLabel("Name").fill("Content Writer");
      await page.getByText("Custom").click();
      await page.getByLabel("Specify a default amount").click();
      await page.getByLabel("Amount", { exact: true }).fill("5000");
      await page.getByLabel("Unit of work").fill("article");
      await page.getByRole("button", { name: "Create", exact: true }).click();

      await expect(page.getByRole("dialog")).not.toBeVisible();
      await expect(page.locator("tbody tr")).toHaveCount(1);
      await expect(page.locator("tbody tr > td")).toHaveText(
        ["Content Writer", "$5,000/ article", "0 candidates", "Not hiring", "Copy link\nEdit"],
        { useInnerText: true },
      );

      let { role, rate } = await fetchRole(company.id);
      expect(role.name).toBe("Content Writer");
      expect(rate.payRateInSubunits).toBe(500000);
      expect(rate.payRateType).toBe(PayRateType.ProjectBased);
      expect(rate.unitOfWork).toBe("article");
    });

    test("without rate", async ({ page }) => {
      const { company } = await setupTest(page);

      await page.getByLabel("Name").fill("Project Manager");
      await page.getByText("Custom").click();
      await page.getByRole("button", { name: "Create", exact: true }).click();

      await expect(page.getByRole("dialog")).not.toBeVisible();
      await expect(page.locator("tbody tr")).toHaveCount(1);
      await expect(page.locator("tbody tr > td")).toHaveText(
        ["Project Manager", "", "0 candidates", "Not hiring", "Copy link\nEdit"],
        { useInnerText: true },
      );

      let { role, rate } = await fetchRole(company.id);
      expect(role.name).toBe("Project Manager");
      expect(rate.payRateInSubunits).toBeNull();
      expect(rate.payRateType).toBe(PayRateType.ProjectBased);
    });
  });
});
