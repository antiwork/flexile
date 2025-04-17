import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { eq, inArray } from "drizzle-orm";
import { companyAdministrators } from "@/db/schema";

test.describe("Board members management", () => {
  test("allows managing board members", async ({ page }) => {
    // Setup two company admins
    const { company } = await companiesFactory.create();
    const { user: admin1 } = await usersFactory.create();
    const { user: admin2 } = await usersFactory.create();

    await companyAdministratorsFactory.create({ companyId: company.id, userId: admin1.id });
    await companyAdministratorsFactory.create({ companyId: company.id, userId: admin2.id });

    await login(page, admin1);
    await page.goto("/administrator/settings/equity", { waitUntil: "networkidle" });

    await page.getByRole("combobox").getByText("Select...").click();
    await page.getByRole("option", { name: admin1.legalName ?? "" }).click();
    await page.getByRole("button", { name: "Save board members" }).click();
    await expect(page.getByRole("button", { name: "Save board members" })).not.toBeDisabled();
    const admin1Record = await db.query.companyAdministrators.findFirst({
      where: eq(companyAdministrators.userId, admin1.id),
    });
    expect(admin1Record?.boardMember).toBe(true);

    await page
      .getByRole("combobox")
      .getByText(admin1.legalName ?? "")
      .click();
    await page.getByRole("option", { name: admin1.legalName ?? "" }).click();
    await page.getByRole("option", { name: admin2.legalName ?? "" }).click();
    await page.getByRole("button", { name: "Save board members" }).click();
    await expect(page.getByRole("button", { name: "Save board members" })).not.toBeDisabled();

    const [admin1UpdatedRecord, admin2Record] = await db.query.companyAdministrators.findMany({
      where: inArray(companyAdministrators.userId, [admin1.id, admin2.id]),
    });
    expect(admin1UpdatedRecord?.boardMember).toBe(false);
    expect(admin2Record?.boardMember).toBe(true);

    await page
      .getByRole("combobox")
      .getByText(admin2.legalName ?? "")
      .click();
    await page.getByRole("option", { name: admin1.legalName ?? "" }).click();
    await page.getByRole("button", { name: "Save board members" }).click();
    await expect(page.getByRole("button", { name: "Save board members" })).not.toBeDisabled();

    const [admin1FinalRecord, admin2FinalRecord] = await db.query.companyAdministrators.findMany({
      where: inArray(companyAdministrators.userId, [admin1.id, admin2.id]),
    });
    expect(admin1FinalRecord?.boardMember).toBe(true);
    expect(admin2FinalRecord?.boardMember).toBe(true);

    await page
      .getByRole("combobox")
      .getByText(`${admin2.legalName ?? ""}, ${admin1.legalName ?? ""}`)
      .click();
    await page.getByRole("option", { name: admin1.legalName ?? "" }).click();
    await page.getByRole("option", { name: admin2.legalName ?? "" }).click();
    await page.getByRole("button", { name: "Save board members" }).click();
    await expect(page.getByRole("button", { name: "Save board members" })).not.toBeDisabled();

    const [admin1LastRecord, admin2LastRecord] = await db.query.companyAdministrators.findMany({
      where: inArray(companyAdministrators.userId, [admin1.id, admin2.id]),
    });
    expect(admin1LastRecord?.boardMember).toBe(false);
    expect(admin2LastRecord?.boardMember).toBe(false);
  });
});
