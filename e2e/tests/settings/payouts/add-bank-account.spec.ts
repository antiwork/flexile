import { db, takeOrThrow } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { userComplianceInfosFactory } from "@test/factories/userComplianceInfos";
import { usersFactory } from "@test/factories/users";
import { selectComboboxOption } from "@test/helpers";
import { login } from "@test/helpers/auth";
import { expect, type Page, test } from "@test/index";
import { eq } from "drizzle-orm";
import { companies, users, wiseRecipients } from "@/db/schema";

async function fillOutUsdBankAccountForm(
  page: Page,
  formValues: {
    legalName: string;
    city: string;
    country: string;
    streetAddress: string;
    state: string;
    zipCode: string;
    routingNumber: string;
    accountNumber: string;
  },
) {
  await selectComboboxOption(page, "Currency", "USD (United States Dollar)");
  await page.getByLabel("Full name of the account holder").fill(formValues.legalName);
  await page.getByLabel("Routing number").fill(formValues.routingNumber);
  await page.getByLabel("Account number").fill(formValues.accountNumber);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Country").click();
  await page.getByRole("option", { name: formValues.country, exact: true }).click();
  await page.getByLabel("City").fill(formValues.city);
  await page.getByLabel("Street address, apt number").fill(formValues.streetAddress);
  await page.getByLabel("State").click();
  await page.getByRole("option", { name: formValues.state, exact: true }).click();
  await page.getByLabel("ZIP code").fill(formValues.zipCode);
}

test.describe("Bank account settings", () => {
  let company: typeof companies.$inferSelect;
  let onboardingUser: typeof users.$inferSelect;

  test.beforeEach(async ({ page }) => {
    company = (await companiesFactory.createCompletedOnboarding()).company;

    onboardingUser = (await usersFactory.create({ state: "Hawaii" })).user;
    await companyContractorsFactory.create(
      { companyId: company.id, userId: onboardingUser.id },
      { withUnsignedContract: true },
    );

    await login(page, onboardingUser);
  });

  test("trims whitespace from fields", async ({ page }) => {
    await page.getByRole("link", { name: "Settings" }).click();
    await page.getByRole("link", { name: "Payouts" }).click();
    await page.getByRole("button", { name: "Add bank account" }).click();
    await fillOutUsdBankAccountForm(page, {
      legalName: ` ${onboardingUser.legalName} `,
      routingNumber: `071004200 `,
      accountNumber: ` 12345678 `,
      country: "United States",
      city: ` ${onboardingUser.city} `,
      streetAddress: ` ${onboardingUser.streetAddress} `,
      state: `${onboardingUser.state}`,
      zipCode: ` ${onboardingUser.zipCode} `,
    });

    await page.getByRole("button", { name: "Save bank account" }).click();

    await expect(page.getByText("Ending in 5678")).toBeVisible();

    const wiseRecipient = await db.query.wiseRecipients
      .findFirst({ where: eq(wiseRecipients.userId, onboardingUser.id) })
      .then(takeOrThrow);
    expect(wiseRecipient.currency).toBe("USD");
    expect(wiseRecipient.lastFourDigits).toBe("5678");
    expect(wiseRecipient.accountHolderName).toBe(onboardingUser.legalName);
    expect(wiseRecipient.countryCode).toBe("US");
  });

  test("allows setting a bank account from Mexico", async ({ page }) => {
    await page.getByRole("link", { name: "Settings" }).click();
    await page.getByRole("link", { name: "Payouts" }).click();
    await page.getByRole("button", { name: "Add bank account" }).click();
    await selectComboboxOption(page, "Currency", "MXN (Mexican Peso)");
    await page.getByLabel("Full name of the account holder").fill(onboardingUser.legalName ?? "");
    await page.getByLabel("CLABE").fill("032180000118359719");

    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByLabel("Country").click();
    await page.getByRole("option", { name: "Mexico" }).click();
    await page.getByLabel("City").fill(" San Andres Cholula ");
    await page.getByLabel("Street address, apt number").fill(" 4 Oriente 820 ");
    await page.getByLabel("Post code").fill(" 72810 ");

    await page.getByRole("button", { name: "Save bank account" }).click();

    await expect(page.getByText("Ending in 9719")).toBeVisible();

    const wiseRecipient = await db.query.wiseRecipients
      .findFirst({
        where: eq(wiseRecipients.userId, onboardingUser.id),
      })
      .then(takeOrThrow);
    expect(wiseRecipient.currency).toBe("MXN");
    expect(wiseRecipient.lastFourDigits).toBe("9719");
    expect(wiseRecipient.accountHolderName).toBe(onboardingUser.legalName);
    expect(wiseRecipient.countryCode).toBe("MX");
  });

  test("hides optional fields for USD", async ({ page }) => {
    await page.getByRole("link", { name: "Settings" }).click();
    await page.getByRole("link", { name: "Payouts" }).click();
    await page.getByRole("button", { name: "Add bank account" }).click();
    await selectComboboxOption(page, "Currency", "USD (United States Dollar)");

    await expect(page.getByLabel("Full name of the account holder")).toBeVisible();
    await expect(page.getByLabel("Email")).not.toBeVisible();
  });

  test("hides optional fields for AED", async ({ page }) => {
    await page.getByRole("link", { name: "Settings" }).click();
    await page.getByRole("link", { name: "Payouts" }).click();
    await page.getByRole("button", { name: "Add bank account" }).click();
    await selectComboboxOption(page, "Currency", "AED (United Arab Emirates Dirham)");

    await expect(page.getByLabel("Full name of the account holder")).toBeVisible();
    await expect(page.getByLabel("Date of birth")).not.toBeVisible();
    await expect(page.getByText("Recipient's Nationality")).not.toBeVisible();
  });

  test("prefills the user's information", async ({ page }) => {
    await page.getByRole("link", { name: "Settings" }).click();
    await page.getByRole("link", { name: "Payouts" }).click();
    await page.getByRole("button", { name: "Add bank account" }).click();
    await expect(page.getByLabel("Full name of the account holder")).toHaveValue(onboardingUser.legalName ?? "");

    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByLabel("State")).toHaveText("Hawaii"); // unabbreviated version
    await expect(page.getByLabel("City")).toHaveValue(onboardingUser.city ?? "");
    await expect(page.getByLabel("Street address, apt number")).toHaveValue(onboardingUser.streetAddress ?? "");
    await expect(page.getByLabel("ZIP code")).toHaveValue(onboardingUser.zipCode ?? "");
  });

  test("validates name and bank account information", async ({ page }) => {
    await page.getByRole("link", { name: "Settings" }).click();
    await page.getByRole("link", { name: "Payouts" }).click();
    await page.getByRole("button", { name: "Add bank account" }).click();
    await page.getByLabel("Full name of the account holder").fill("Da R");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Save bank account" }).click();
    await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
    await expect(page.getByLabel("Full name of the account holder")).not.toBeValid();
    await expect(page.getByLabel("Account number")).not.toBeValid();
    await expect(page.getByLabel("Routing number")).not.toBeValid();
    await expect(page.getByText("Please enter an account number.")).toBeVisible();
    await expect(page.getByText("This doesn't look like a full legal name.")).toBeVisible();

    await page.getByLabel("Full name of the account holder").fill("Jane Doe");
    await expect(page.getByLabel("Full name of the account holder")).toBeValid();
    await page.getByLabel("Routing number").fill("123456789");
    await page.getByLabel("Account number").fill("1");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Save bank account" }).click();

    await expect(page.getByLabel("Account number")).not.toBeValid();
    await expect(page.getByLabel("Routing number")).not.toBeValid();
    await expect(page.getByText("Please enter a valid account number of between 4 and 17 digits.")).toBeVisible();
    await expect(page.getByText("This doesn't look like a valid ACH routing number.")).toBeVisible();

    await page.getByLabel("Account number").fill("abcd");
    await page.getByLabel("Account number").fill("12345678");
    await page.getByLabel("Routing number").fill("071004200");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Save bank account" }).click();

    await expect(page.getByText("Saving bank account...")).toBeVisible();
  });

  test("allows an EUR Recipient to submit bank account info", async ({ page }) => {
    await page.getByRole("link", { name: "Settings" }).click();
    await page.getByRole("link", { name: "Payouts" }).click();
    await page.getByRole("button", { name: "Add bank account" }).click();
    await selectComboboxOption(page, "Currency", "EUR (Euro)");
    await expect(page.getByLabel("Full name of the account holder")).toHaveValue(onboardingUser.legalName ?? "");
    await page.getByLabel("IBAN").fill("HR7624020064583467589");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByLabel("Country")).toHaveText("United States");
    await page.getByLabel("Country").click();
    await page.getByRole("option", { name: "Croatia" }).click();
    await page.getByLabel("City").fill("Zagreb");
    await page.getByLabel("Street address, apt number").fill("Ulica Suha Punta 3");
    await page.getByLabel("Post code").fill("23000");

    await page.getByRole("button", { name: "Save bank account" }).click();

    await expect(page.getByText("Ending in 7589")).toBeVisible();
  });

  test("allows a CAD Recipient to submit bank account info", async ({ page }) => {
    await page.getByRole("link", { name: "Settings" }).click();
    await page.getByRole("link", { name: "Payouts" }).click();
    await page.getByRole("button", { name: "Add bank account" }).click();
    await selectComboboxOption(page, "Currency", "CAD (Canadian Dollar)");
    await expect(page.getByLabel("Full name of the account holder")).toHaveValue(onboardingUser.legalName ?? "");
    await page.getByLabel("Institution number").fill("006");
    await page.getByLabel("Transit number").fill("04841");
    await page.getByLabel("Account number").fill("3456712");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByLabel("Country")).toHaveText("United States");
    await page.getByLabel("Country").click();
    await page.getByRole("option", { name: "Canada" }).click();
    await page.getByLabel("City").fill(onboardingUser.city ?? "");
    await page.getByLabel("Street address, apt number").fill("59-720 Kamehameha Hwy");
    await page.getByLabel("Province").click();
    await page.getByRole("option", { name: "Alberta" }).click();
    await page.getByLabel("Post code").fill("A2A 2A2");

    await page.getByRole("button", { name: "Save bank account" }).click();

    await expect(page.getByText("Ending in 6712")).toBeVisible();
  });

  test("shows relevant account types for individual entity", async ({ page }) => {
    await page.getByRole("link", { name: "Settings" }).click();
    await page.getByRole("link", { name: "Payouts" }).click();
    await page.getByRole("button", { name: "Add bank account" }).click();
    await selectComboboxOption(page, "Currency", "KRW (South Korean Won)");
    await expect(page.getByLabel("Date of birth")).toBeVisible();
    await expect(page.getByLabel("Bank name")).toBeVisible();
    await expect(page.getByLabel("Account number (KRW accounts only)")).toBeVisible();
  });

  test.describe("when the user is a business entity", () => {
    test.beforeEach(async () => {
      await userComplianceInfosFactory.create({
        userId: onboardingUser.id,
        businessEntity: true,
        businessName: "Business Inc.",
      });
    });

    test("shows relevant account types", async ({ page }) => {
      await page.getByRole("link", { name: "Settings" }).click();
      await page.getByRole("link", { name: "Payouts" }).click();
      await page.getByRole("button", { name: "Add bank account" }).click();
      await selectComboboxOption(page, "Currency", "KRW (South Korean Won)");
      await expect(page.getByLabel("Name of the business / organisation")).toBeVisible();
      await expect(page.getByLabel("Bank name")).toBeVisible();
      await expect(page.getByLabel("Account number (KRW accounts only)")).toBeVisible();
    });

    test("prefills the account holder field with the business name", async ({ page }) => {
      await page.getByRole("link", { name: "Settings" }).click();
      await page.getByRole("link", { name: "Payouts" }).click();
      await page.getByRole("button", { name: "Add bank account" }).click();
      await selectComboboxOption(page, "Currency", "USD (United States Dollar)");
      await expect(page.getByLabel("Name of the business / organisation")).toHaveValue("Business Inc.");
    });
  });

  test.describe("address fields", () => {
    test("shows state field", async ({ page }) => {
      await page.getByRole("link", { name: "Settings" }).click();
      await page.getByRole("link", { name: "Payouts" }).click();
      await page.getByRole("button", { name: "Add bank account" }).click();
      await selectComboboxOption(page, "Currency", "USD (United States Dollar)");
      await page.getByRole("button", { name: "Continue" }).click();
      await page.getByLabel("Country").click();
      await page.getByRole("option", { name: "United States", exact: true }).click();
      await expect(page.getByLabel("State")).toBeVisible();
      await expect(page.getByLabel("ZIP code")).toBeVisible();
    });

    test("shows province field", async ({ page }) => {
      await page.getByRole("link", { name: "Settings" }).click();
      await page.getByRole("link", { name: "Payouts" }).click();
      await page.getByRole("button", { name: "Add bank account" }).click();
      await selectComboboxOption(page, "Currency", "USD (United States Dollar)");
      await page.getByRole("button", { name: "Continue" }).click();
      await page.getByLabel("Country").click();
      await page.getByRole("option", { name: "Canada" }).click();
      await expect(page.getByLabel("Province")).toBeVisible();
      await expect(page.getByLabel("Post code")).toBeVisible();
    });

    test("only shows post code field for United Kingdom", async ({ page }) => {
      await page.getByRole("link", { name: "Settings" }).click();
      await page.getByRole("link", { name: "Payouts" }).click();
      await page.getByRole("button", { name: "Add bank account" }).click();
      await selectComboboxOption(page, "Currency", "USD (United States Dollar)");
      await page.getByRole("button", { name: "Continue" }).click();
      await page.getByLabel("Country").click();
      await page.getByRole("option", { name: "United Kingdom" }).click();
      await expect(page.getByLabel("Post code")).toBeVisible();
      await expect(page.getByLabel("Province")).not.toBeVisible();
      await expect(page.getByLabel("State")).not.toBeVisible();
    });

    test("does not show state or post code fields for Bahamas", async ({ page }) => {
      await page.getByRole("link", { name: "Settings" }).click();
      await page.getByRole("link", { name: "Payouts" }).click();
      await page.getByRole("button", { name: "Add bank account" }).click();
      await selectComboboxOption(page, "Currency", "USD (United States Dollar)");
      await page.getByRole("button", { name: "Continue" }).click();
      await page.getByLabel("Country").click();
      await page.getByRole("option", { name: "Bahamas" }).click();
      await expect(page.getByLabel("Post code")).not.toBeVisible();
      await expect(page.getByLabel("Province")).not.toBeVisible();
      await expect(page.getByLabel("State")).not.toBeVisible();
    });

    test("shows optional Prefecture field for Japan", async ({ page }) => {
      await page.getByRole("link", { name: "Settings" }).click();
      await page.getByRole("link", { name: "Payouts" }).click();
      await page.getByRole("button", { name: "Add bank account" }).click();
      await page.getByRole("button", { name: "Continue" }).click();
      await page.getByLabel("Country").click();
      await page.getByRole("option", { name: "Japan" }).click();
      await expect(page.getByLabel("Prefecture (optional)")).toBeVisible();
    });

    test("shows optional Region field for New Zealand", async ({ page }) => {
      await page.getByRole("link", { name: "Settings" }).click();
      await page.getByRole("link", { name: "Payouts" }).click();
      await page.getByRole("button", { name: "Add bank account" }).click();
      await page.getByRole("button", { name: "Continue" }).click();
      await page.getByLabel("Country").click();
      await page.getByRole("option", { name: "New Zealand" }).click();
      await expect(page.getByLabel("Region (optional)")).toBeVisible();
    });
  });

  test.describe("currency field", () => {
    test.describe("when user's country is United States", () => {
      test("should pre-fill currency with USD", async ({ page }) => {
        await page.getByRole("link", { name: "Settings" }).click();
        await page.getByRole("link", { name: "Payouts" }).click();
        await page.getByRole("button", { name: "Add bank account" }).click();
        await expect(page.getByLabel("Currency")).toContainText("USD (United States Dollar)");
      });
    });

    test.describe("when user's country is France", () => {
      test("should pre-fill currency with EUR", async ({ page }) => {
        await db.update(users).set({ countryCode: "FR" }).where(eq(users.id, onboardingUser.id));
        await page.getByRole("link", { name: "Settings" }).click();
        await page.getByRole("link", { name: "Payouts" }).click();
        await page.getByRole("button", { name: "Add bank account" }).click();
        await expect(page.getByLabel("Currency")).toContainText("EUR (Euro)");
      });
    });

    test.describe("when user's country is Germany", () => {
      test("should pre-fill currency with EUR", async ({ page }) => {
        await db.update(users).set({ countryCode: "DE" }).where(eq(users.id, onboardingUser.id));
        await page.getByRole("link", { name: "Settings" }).click();
        await page.getByRole("link", { name: "Payouts" }).click();
        await page.getByRole("button", { name: "Add bank account" }).click();
        await expect(page.getByLabel("Currency")).toContainText("EUR (Euro)");
      });
    });

    test.describe("when user's country is Canada", () => {
      test("should pre-fill currency with CAD", async ({ page }) => {
        await db.update(users).set({ countryCode: "CA" }).where(eq(users.id, onboardingUser.id));
        await page.getByRole("link", { name: "Settings" }).click();
        await page.getByRole("link", { name: "Payouts" }).click();
        await page.getByRole("button", { name: "Add bank account" }).click();
        await expect(page.getByLabel("Currency")).toContainText("CAD (Canadian Dollar)");
      });
    });

    test.describe("when user's country is Croatia", () => {
      test("pre-fills currency with EUR", async ({ page }) => {
        await db.update(users).set({ countryCode: "HR" }).where(eq(users.id, onboardingUser.id));
        await page.getByRole("link", { name: "Settings" }).click();
        await page.getByRole("link", { name: "Payouts" }).click();
        await page.getByRole("button", { name: "Add bank account" }).click();
        await expect(page.getByLabel("Currency")).toContainText("EUR (Euro)");
      });
    });
  });

  test.describe("account type selection", () => {
    test("hides account type and selects the only account type option for AED currency", async ({ page }) => {
      await page.getByRole("link", { name: "Settings" }).click();
      await page.getByRole("link", { name: "Payouts" }).click();
      await page.getByRole("button", { name: "Add bank account" }).click();
      await selectComboboxOption(page, "Currency", "AED (United Arab Emirates Dirham)");
      await expect(page.getByLabel("Full name of the account holder")).toBeVisible();
      await expect(page.getByLabel("IBAN")).toBeVisible();
      await expect(page.getByLabel("Account Type")).not.toBeVisible();
    });

    test.describe("when the user is from the United States", () => {
      test("shows local bank account when the currency is GBP", async ({ page }) => {
        await page.getByRole("link", { name: "Settings" }).click();
        await page.getByRole("link", { name: "Payouts" }).click();
        await page.getByRole("button", { name: "Add bank account" }).click();
        await selectComboboxOption(page, "Currency", "GBP (British Pound)");
        await expect(page.getByLabel("Full name of the account holder")).toBeVisible();
        await expect(page.getByLabel("UK sort code")).toBeVisible();
        await expect(page.getByLabel("Account number")).toBeVisible();
        await expect(page.getByLabel("I'd prefer to use IBAN")).toBeVisible();
        await expect(page.getByLabel("Account Type")).not.toBeVisible();
      });

      test("shows local bank account when the currency is HKD", async ({ page }) => {
        await page.getByRole("link", { name: "Settings" }).click();
        await page.getByRole("link", { name: "Payouts" }).click();
        await page.getByRole("button", { name: "Add bank account" }).click();
        await selectComboboxOption(page, "Currency", "HKD (Hong Kong Dollar)");
        await page.getByLabel("I'd prefer to use FPS ID").click();
        await expect(page.getByLabel("Full name of the account holder")).toBeVisible();
        await expect(page.getByLabel("Bank name")).toBeVisible();
        await expect(page.getByLabel("Account number")).toBeVisible();
        await expect(page.getByLabel("I'd prefer to use FPS ID")).toBeVisible();
        await expect(page.getByLabel("Account Type")).not.toBeVisible();
      });

      test("shows local bank account when the currency is HUF", async ({ page }) => {
        await page.getByRole("link", { name: "Settings" }).click();
        await page.getByRole("link", { name: "Payouts" }).click();
        await page.getByRole("button", { name: "Add bank account" }).click();
        await selectComboboxOption(page, "Currency", "HUF (Hungarian Forint)");
        await expect(page.getByLabel("Full name of the account holder")).toBeVisible();
        await expect(page.getByLabel("Account number")).toBeVisible();
        await expect(page.getByLabel("I'd prefer to use IBAN")).toBeVisible();
        await expect(page.getByLabel("Account Type")).not.toBeVisible();
      });

      test("shows local bank account when the currency is IDR", async ({ page }) => {
        await page.getByRole("link", { name: "Settings" }).click();
        await page.getByRole("link", { name: "Payouts" }).click();
        await page.getByRole("button", { name: "Add bank account" }).click();
        await selectComboboxOption(page, "Currency", "IDR (Indonesian Rupiah)");
        await expect(page.getByLabel("Full name of the account holder")).toBeVisible();
        await expect(page.getByLabel("Bank name")).toBeVisible();
        await expect(page.getByLabel("Account number (IDR accounts only)")).toBeVisible();
        await expect(page.getByLabel("Account Type")).not.toBeVisible();
      });

      test("shows local bank account when the currency is KES", async ({ page }) => {
        await page.getByRole("link", { name: "Settings" }).click();
        await page.getByRole("link", { name: "Payouts" }).click();
        await page.getByRole("button", { name: "Add bank account" }).click();
        await selectComboboxOption(page, "Currency", "KES (Kenyan Shilling)");
        await expect(page.getByLabel("Full name of the account holder")).toBeVisible();
        await expect(page.getByLabel("Bank name")).toBeVisible();
        await expect(page.getByLabel("Account number")).toBeVisible();
        await expect(page.getByLabel("Account Type")).not.toBeVisible();
      });

      test("shows local bank account when the currency is PHP", async ({ page }) => {
        await page.getByRole("link", { name: "Settings" }).click();
        await page.getByRole("link", { name: "Payouts" }).click();
        await page.getByRole("button", { name: "Add bank account" }).click();
        await selectComboboxOption(page, "Currency", "PHP (Philippine Peso)");
        await expect(page.getByLabel("Full name of the account holder")).toBeVisible();
        await expect(page.getByLabel("Bank name")).toBeVisible();
        await expect(page.getByLabel("Account number (PHP accounts only)")).toBeVisible();
        await expect(page.getByLabel("Account Type")).not.toBeVisible();
      });

      test("shows local bank account when the currency is PLN", async ({ page }) => {
        await page.getByRole("link", { name: "Settings" }).click();
        await page.getByRole("link", { name: "Payouts" }).click();
        await page.getByRole("button", { name: "Add bank account" }).click();
        await selectComboboxOption(page, "Currency", "PLN (Polish Złoty)");
        await expect(page.getByLabel("Full name of the account holder")).toBeVisible();
        await expect(page.getByLabel("Account number")).toBeVisible();
        await expect(page.getByLabel("I'd prefer to use IBAN")).toBeVisible();
        await expect(page.getByLabel("Account Type")).not.toBeVisible();
      });

      test("shows IBAN when the currency is UAH", async ({ page }) => {
        await page.getByRole("link", { name: "Settings" }).click();
        await page.getByRole("link", { name: "Payouts" }).click();
        await page.getByRole("button", { name: "Add bank account" }).click();
        await selectComboboxOption(page, "Currency", "UAH (Ukrainian Hryvnia)");
        await expect(page.getByLabel("Full name of the account holder")).toBeVisible();
        await expect(page.getByLabel("IBAN")).toBeVisible();
        await expect(page.getByLabel("I'd prefer to use PrivatBank card")).toBeVisible();
        await expect(page.getByLabel("Account Type")).not.toBeVisible();
      });
    });

    test.describe("when the user is from Germany", () => {
      test.beforeEach(async () => {
        const countryCode = "DE";
        await db
          .update(users)
          .set({ countryCode, citizenshipCountryCode: countryCode })
          .where(eq(users.id, onboardingUser.id));
      });

      test("shows local bank account form by default", async ({ page }) => {
        await page.getByRole("link", { name: "Settings" }).click();
        await page.getByRole("link", { name: "Payouts" }).click();
        await page.getByRole("button", { name: "Add bank account" }).click();
        await expect(page.getByLabel("Full name of the account holder")).toBeVisible();
        await expect(page.getByLabel("IBAN")).toBeVisible();
        await expect(page.getByLabel("I'd prefer to use SWIFT")).toBeVisible();
        await expect(page.getByLabel("Account Type")).not.toBeVisible();
      });

      test("shows SWIFT account if prefer to use SWIFT checkbox is checked", async ({ page }) => {
        await page.getByRole("link", { name: "Settings" }).click();
        await page.getByRole("link", { name: "Payouts" }).click();
        await page.getByRole("button", { name: "Add bank account" }).click();
        await page.getByLabel("I'd prefer to use SWIFT").check();
        await expect(page.getByLabel("SWIFT / BIC code")).toBeVisible();
        await expect(page.getByLabel("Account number")).toBeVisible();
      });
    });
  });
});
