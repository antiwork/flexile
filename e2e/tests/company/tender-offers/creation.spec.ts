import { db, takeOrThrow } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { fillDatePicker } from "@test/helpers";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { eq } from "drizzle-orm";
import { users } from "@/db/schema";

test.describe("Buyback creation", () => {
  test("allows creating a new buyback", async ({ page }) => {
    const { company } = await companiesFactory.create({
      equityEnabled: true,
    });

    const { administrator } = await companyAdministratorsFactory.create({
      companyId: company.id,
    });
    const user = await db.query.users
      .findFirst({
        where: eq(users.id, administrator.userId),
      })
      .then(takeOrThrow);

    await login(page, user);

    await page.getByRole("button", { name: "Equity" }).click();
    await page.getByRole("link", { name: "Buybacks" }).click();
    await page.getByRole("link", { name: "New buyback" }).click();

    await fillDatePicker(page, "Start date", "08/08/2022");
    await fillDatePicker(page, "End date", "09/09/2022");
    await page.getByLabel("Starting valuation").fill("100000000");
    await page.getByLabel("Document package").setInputFiles("e2e/samples/sample.zip");

    await page.getByRole("button", { name: "Create buyback" }).click();
    await expect(page.getByText("There are no buybacks yet.")).toBeVisible();
    await page.reload();

    await expect(
      page.getByRole("row", {
        name: /Aug 8, 2022.*Sep 9, 2022.*\$100,000,000/u,
      }),
    ).toBeVisible();
  });
});
