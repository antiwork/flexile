import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { mockDocuseal } from "@test/helpers/docuseal";
import { expect, test } from "@test/index";
import { eq } from "drizzle-orm";
import { companyContractors, companyRoles } from "@/db/schema";
import { assertDefined } from "@/utils/assert";
import { formatMoneyFromCents } from "@/utils/formatMoney";

test.describe("Company roles", () => {
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
    const fetchRole = async () => {
      const role = assertDefined(
        await db.query.companyRoles.findFirst({
          where: eq(companyRoles.companyId, company.id),
          with: { rates: true },
        }),
      );
      return { role, rate: assertDefined(role.rates[0]) };
    };
    let { role, rate } = await fetchRole();

    await login(page, adminUser);
    await page.getByRole("link", { name: "Roles" }).click();
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(page.locator("tbody tr > td")).toHaveText(
      [role.name, `${formatMoneyFromCents(rate.payRateInSubunits)} / hr`, "Copy link\nEdit"],
      { useInnerText: true },
    );
    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Name").fill("Role 1");
    await page.getByLabel("Rate", { exact: true }).fill("1000");
    expect(await page.getByLabel("Update rate for all contractors with this role").isChecked()).toBe(false);
    await expect(page.getByText("1 contractor has a different rate that won't be updated")).toBeVisible();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.locator("tbody tr > td")).toHaveText(
      ["Role 1", `${formatMoneyFromCents(100000)} / hr`, "Copy link\nEdit"],
      { useInnerText: true },
    );
    ({ role, rate } = await fetchRole());
    expect(role).toMatchObject({ name: "Role 1" });
    expect(rate).toMatchObject({ payRateInSubunits: 100000 });
    expect(sentEmails).toHaveLength(0);

    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Update rate for all contractors with this role").check();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Update rates for 1 contractor to match role rate?")).toBeVisible();
    await expect(page.getByText(`${contractorUser.preferredName}$60 $1,000 (1,566.67%)`)).toBeVisible();
    await page.getByRole("button", { name: "Yes, change" }).click();
    await expect(page.getByText("Edit role")).not.toBeVisible();
    ({ role, rate } = await fetchRole());
    expect(role).toMatchObject({ name: "Role 1" });
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
});
