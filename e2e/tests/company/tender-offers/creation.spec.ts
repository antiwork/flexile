import { db, takeOrThrow } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { eq } from "drizzle-orm";
import { users } from "@/db/schema";

test.describe("Buyback creation", () => {
  test("allows creating a new buyback", async ({ page }) => {
    const { company } = await companiesFactory.create({
      tenderOffersEnabled: true,
      capTableEnabled: true,
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

    await page.getByRole("link", { name: "Equity" }).click();
    await page.getByRole("tab", { name: "Buybacks" }).click();
    await page.getByRole("link", { name: "New buyback" }).click();

    await page.getByLabel("Minimum valuation").fill("100000000");
    await page.getByLabel("Start date").fill("2022-08-08");
    await page.getByLabel("End date").fill("2022-09-09");
    await page.getByLabel("Attachment").setInputFiles("e2e/samples/sample.zip");

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
