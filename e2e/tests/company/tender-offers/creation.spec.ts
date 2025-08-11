import { faker } from "@faker-js/faker";
import { db, takeOrThrow } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { fillDatePicker } from "@test/helpers";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { addDays, format, formatDate } from "date-fns";
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

    const startDate = new Date();
    const endDate = addDays(new Date(), 30);

    await fillDatePicker(page, "Start date", format(startDate, "MM/dd/yyyy"));
    await fillDatePicker(page, "End date", format(endDate, "MM/dd/yyyy"));
    await page.getByLabel("Starting valuation").fill("100000000");
    await page.getByLabel("Document package").setInputFiles("e2e/samples/sample.zip");

    const letterOfTransmittal = faker.lorem.paragraphs();
    await page.locator('.tiptap[contenteditable="true"]').fill(letterOfTransmittal);

    await page.getByRole("button", { name: "Create buyback" }).click();
    await expect(page.getByText("There are no buybacks yet.")).toBeVisible();
    await page.reload();

    await page
      .getByRole("row", {
        name: new RegExp(`${formatDate(endDate, "MMM d, yyyy")}.*\\$100,000,000`, "u"),
      })
      .click();

    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator(".prose")).toContainText(letterOfTransmittal.substring(0, 50));
  });
});
