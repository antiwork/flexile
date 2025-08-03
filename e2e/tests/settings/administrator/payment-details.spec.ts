import { db, takeOrThrow } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { and, eq, isNull } from "drizzle-orm";
import { companyStripeAccounts, users } from "@/db/schema";

test.describe("Company administrator settings - payment details", () => {
  test("allows connecting a bank account", async ({ page }) => {
    const { company } = await companiesFactory.create({ stripeCustomerId: null }, { withoutBankAccount: true });
    const { administrator } = await companyAdministratorsFactory.create({ companyId: company.id });
    const adminUser = await db.query.users.findFirst({ where: eq(users.id, administrator.userId) }).then(takeOrThrow);

    await login(page, adminUser);
    await page.getByRole("link", { name: "Settings" }).click();
    await page.getByRole("link", { name: "Billing" }).click();

    await expect(
      page.getByText("We'll use this account to debit contractor payments and our monthly fee"),
    ).toBeVisible();
    await expect(page.getByText("Payments to contractors may take up to 10 business days to process.")).toBeVisible();
    await page.getByRole("button", { name: "Link your bank account" }).click();

    const stripeFrame = page.frameLocator("[src^='https://js.stripe.com/v3/elements-inner-payment']");
    await stripeFrame.getByLabel("Test Institution").click();

    const bankFrame = page.frameLocator("[src^='https://js.stripe.com/v3/linked-accounts-inner']");
    await bankFrame.getByRole("button", { name: "Agree" }).click();
    await bankFrame.getByTestId("success").click();
    await bankFrame.getByRole("button", { name: "Connect account" }).click();
    await bankFrame.getByRole("button", { name: "Back to Flexile" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.getByText("USD bank account")).toBeVisible();
    await expect(page.getByText("Ending in 6789")).toBeVisible();

    let companyStripeAccount = await db.query.companyStripeAccounts
      .findFirst({
        where: and(eq(companyStripeAccounts.companyId, company.id), isNull(companyStripeAccounts.deletedAt)),
      })
      .then(takeOrThrow);
    expect(companyStripeAccount.status).toBe("processing");
    expect(companyStripeAccount.bankAccountLastFour).toBe("6789");

    await page.getByRole("button", { name: "Edit" }).click();
    await stripeFrame.getByLabel("Test Institution").click();
    await bankFrame.getByRole("button", { name: "Agree" }).click();
    await bankFrame.getByRole("button", { name: "High Balance" }).click();
    await bankFrame.getByRole("button", { name: "Connect account" }).click();
    await bankFrame.getByRole("button", { name: "Back to Flexile" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.getByText("USD bank account")).toBeVisible();
    await expect(page.getByText("Ending in 4321")).toBeVisible();

    companyStripeAccount = await db.query.companyStripeAccounts
      .findFirst({
        where: and(eq(companyStripeAccounts.companyId, company.id), isNull(companyStripeAccounts.deletedAt)),
      })
      .then(takeOrThrow);
    expect(companyStripeAccount.status).toBe("processing");
    expect(companyStripeAccount.bankAccountLastFour).toBe("4321");
  });

  test("allows manually connecting a bank account with microdeposit verification", async ({ page }) => {
    const { company } = await companiesFactory.create({ stripeCustomerId: null }, { withoutBankAccount: true });
    const { administrator } = await companyAdministratorsFactory.create({ companyId: company.id });
    const adminUser = await db.query.users.findFirst({ where: eq(users.id, administrator.userId) }).then(takeOrThrow);

    await login(page, adminUser);
    await page.getByRole("link", { name: "Settings" }).click();
    await page.getByRole("link", { name: "Billing" }).click();
    await page.getByRole("button", { name: "Link your bank account" }).click();

    const stripeFrame = page.frameLocator("[src^='https://js.stripe.com/v3/elements-inner-payment']");
    await stripeFrame.getByRole("button", { name: "Enter bank details manually instead" }).click();

    const bankFrame = page.frameLocator("[src^='https://js.stripe.com/v3/linked-accounts-inner']");
    await bankFrame.getByLabel("Routing number").fill("110000000");
    await bankFrame.getByTestId("manualEntry-accountNumber-input").fill("000123456789");
    await bankFrame.getByTestId("manualEntry-confirmAccountNumber-input").fill("000123456789");
    await bankFrame.getByRole("button", { name: "Submit" }).click();

    await expect(
      bankFrame.getByText(
        "Next, finish up on Flexile to initiate micro-deposits. You can expect an email with instructions within 1-2 business days.",
      ),
    ).toBeVisible();

    await bankFrame.getByRole("button", { name: "Back to Flexile" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();

    await expect(page.getByText("Verify your bank account to enable contractor payments")).toBeVisible();

    const companyStripeAccount = await db.query.companyStripeAccounts
      .findFirst({ where: eq(companyStripeAccounts.companyId, company.id) })
      .then(takeOrThrow);
    expect(companyStripeAccount.status).toBe("processing");
  });
});
