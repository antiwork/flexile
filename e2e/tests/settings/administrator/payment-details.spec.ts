import { db, takeOrThrow } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { and, eq, isNull } from "drizzle-orm";
import { companyStripeAccounts, users } from "@/db/schema";

// allow green builds on OSS PRs that don't have a stripe sandbox key, but fail on CI if something changes on Stripe's end
test.skip(() => process.env.STRIPE_SECRET_KEY === "dummy");
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

  test("allows connecting a bank account via microdeposits (amounts or descriptor code)", async ({ page }) => {
    const { company } = await companiesFactory.create({ stripeCustomerId: null }, { withoutBankAccount: true });
    const { administrator } = await companyAdministratorsFactory.create({ companyId: company.id });
    const adminUser = await db.query.users.findFirst({ where: eq(users.id, administrator.userId) }).then(takeOrThrow);

    await login(page, adminUser);
    await page.getByRole("link", { name: "Settings" }).click();
    await page.getByRole("link", { name: "Billing" }).click();

    await expect(
      page.getByText("We'll use this account to debit contractor payments and our monthly fee"),
    ).toBeVisible();

    await page.getByRole("button", { name: "Link your bank account" }).click();

    const stripePaymentFrame = page
      .locator("iframe[src*='js.stripe.com/v3/elements-inner-payment']")
      .first()
      .contentFrame();
    await stripePaymentFrame.getByRole("button", { name: /Enter bank details manually/iu }).click();

    const stripeBankFrame = page
      .locator("iframe[src*='js.stripe.com/v3/linked-accounts-inner']")
      .first()
      .contentFrame();
    await stripeBankFrame.getByLabel("Routing number").waitFor({ state: "visible" });
    await stripeBankFrame.getByLabel("Routing number").fill("110000000");
    await stripeBankFrame.getByTestId("manualEntry-accountNumber-input").fill("000123456789");
    await stripeBankFrame.getByTestId("manualEntry-confirmAccountNumber-input").fill("000123456789");

    await stripeBankFrame.getByRole("button", { name: "Submit" }).click();

    const bankFrame = page.frameLocator("iframe[src*='js.stripe.com/v3/linked-accounts-inner']");
    const linkNotNowButton = bankFrame.getByTestId("link-not-now-button");
    const completionText = bankFrame.getByText(/Next, finish up on/iu);

    await Promise.race([
      linkNotNowButton.waitFor({ state: "visible" }).catch(() => undefined),
      completionText.waitFor({ state: "visible" }).catch(() => undefined),
    ]);

    if (await linkNotNowButton.isVisible().catch(() => false)) {
      await linkNotNowButton.click();
    }

    await bankFrame.getByRole("button", { name: /Back to/iu }).click();

    await expect(page.getByRole("dialog")).not.toBeVisible();

    const bannerLocator = page.getByText("Verify your bank account to enable contractor payments");
    await expect(bannerLocator).toBeVisible();

    const companyStripeAccount = await db.query.companyStripeAccounts
      .findFirst({ where: eq(companyStripeAccounts.companyId, company.id) })
      .then(takeOrThrow);
    expect(companyStripeAccount.status).toBe("processing");

    await page.getByRole("button", { name: "Verify bank account" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Stripe determines at runtime whether microdeposits use two "amounts" or a "descriptor_code" (6-digit code).
    // The Payment Element does not allow forcing a specific type, so the test handles both.
    const codeInput = page.getByLabel("6-digit code");
    if (await codeInput.isVisible().catch(() => false)) {
      await codeInput.fill("SM11AA");
      await expect(codeInput).toHaveValue("SM11AA");
    } else {
      const amount1Input = page.getByLabel("Amount 1");
      await amount1Input.fill("0.32");
      await expect(amount1Input).toHaveValue("0.32");

      const amount2Input = page.getByLabel("Amount 2");
      await amount2Input.fill("0.45");
      await expect(amount2Input).toHaveValue("0.45");
    }

    await page.getByRole("button", { name: "Submit" }).click();

    await expect(page.getByRole("dialog")).not.toBeVisible();

    const updatedStripeAccount = await db.query.companyStripeAccounts
      .findFirst({ where: eq(companyStripeAccounts.companyId, company.id) })
      .then(takeOrThrow);

    expect(updatedStripeAccount.setupIntentId).toBeTruthy();
    expect(updatedStripeAccount.bankAccountLastFour).toBe("6789");
  });
});
