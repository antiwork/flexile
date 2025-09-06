import { db, takeOrThrow } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { login } from "@test/helpers/auth";
import { expect, test, withinModal } from "@test/index";
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

    const stripePaymentFrame = page.frameLocator("[src^='https://js.stripe.com/v3/elements-inner-payment']");
    const stripeBankFrame = page.frameLocator("[src^='https://js.stripe.com/v3/linked-accounts-inner']");

    await withinModal(
      async () => {
        await stripePaymentFrame.getByLabel("Test Institution").click();
        await stripeBankFrame.getByTestId("agree-button").click();
        await stripeBankFrame.getByTestId("success").click();
        await stripeBankFrame.getByTestId("select-button").click();
        await stripeBankFrame.getByTestId("link-not-now-button").click();
        await stripeBankFrame.getByTestId("done-button").click();
      },
      { page, title: "Link your bank account" },
    );

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
    await withinModal(
      async () => {
        await stripePaymentFrame.getByLabel("Test Institution").click();
        await stripeBankFrame.getByTestId("agree-button").click();
        await stripeBankFrame.getByTestId("high balance").click();
        await stripeBankFrame.getByTestId("select-button").click();
        await stripeBankFrame.getByTestId("link-not-now-button").click();
        await stripeBankFrame.getByTestId("done-button").click();
      },
      { page, title: "Link your bank account" },
    );

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

    await withinModal(
      async () => {
        await page
          .frameLocator("[src^='https://js.stripe.com/v3/elements-inner-payment']")
          .getByRole("button", { name: "Enter bank details manually" })
          .click();
        const stripeBankFrame = page.frameLocator("[src^='https://js.stripe.com/v3/linked-accounts-inner']");
        await expect(stripeBankFrame.getByLabel("Routing number")).toBeVisible();
        await stripeBankFrame.getByTestId("manualEntry-routingNumber-input").fill("110000000");
        await stripeBankFrame.getByTestId("manualEntry-accountNumber-input").fill("000123456789");
        await stripeBankFrame.getByTestId("manualEntry-confirmAccountNumber-input").fill("000123456789");
        await stripeBankFrame.getByTestId("continue-button").click();
        await stripeBankFrame.getByTestId("link-not-now-button").click();
        await stripeBankFrame.getByTestId("done-button").click();
      },
      { page, title: "Link your bank account" },
    );

    const bannerLocator = page.getByText("Verify your bank account to enable contractor payments");
    await expect(bannerLocator).toBeVisible();

    const companyStripeAccount = await db.query.companyStripeAccounts
      .findFirst({ where: eq(companyStripeAccounts.companyId, company.id) })
      .then(takeOrThrow);
    expect(companyStripeAccount.status).toBe("processing");

    await page.getByRole("button", { name: "Verify bank account" }).click();

    await withinModal(
      async (modal) => {
        // Stripe determines at runtime whether microdeposits use two "amounts" or a "descriptor_code" (6-digit code).
        // The Payment Element does not allow forcing a specific type, so the test handles both.
        const codeInput = modal.getByLabel("6-digit code");
        if (await codeInput.isVisible().catch(() => false)) {
          await codeInput.fill("SM11AA");
          await expect(codeInput).toHaveValue("SM11AA");
        } else {
          const amount1Input = modal.getByLabel("Amount 1");
          await amount1Input.fill("0.32");
          await expect(amount1Input).toHaveValue("0.32");

          const amount2Input = modal.getByLabel("Amount 2");
          await amount2Input.fill("0.45");
          await expect(amount2Input).toHaveValue("0.45");
        }

        await page.getByRole("button", { name: "Submit" }).click();
      },
      { page },
    );

    const updatedStripeAccount = await db.query.companyStripeAccounts
      .findFirst({ where: eq(companyStripeAccounts.companyId, company.id) })
      .then(takeOrThrow);

    expect(updatedStripeAccount.setupIntentId).toBeTruthy();
    expect(updatedStripeAccount.bankAccountLastFour).toBe("6789");
  });
});
