import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { usersFactory } from "@test/factories/users";
import { selectComboboxOption } from "@test/helpers";
import { login } from "@test/helpers/auth";
import { expect, type Page, test, withinModal } from "@test/index";
import { eq } from "drizzle-orm";
import { companies, companyAdministrators, userComplianceInfos, users } from "@/db/schema";

test.describe.skip("Contractor onboarding - legal details", () => {
  let company: typeof companies.$inferSelect;
  let companyAdministrator: typeof companyAdministrators.$inferSelect;
  let onboardingUser: typeof users.$inferSelect;

  test.beforeEach(async () => {
    company = (await companiesFactory.create()).company;
    companyAdministrator = (
      await companyAdministratorsFactory.create({
        companyId: company.id,
      })
    ).administrator;

    onboardingUser = (
      await usersFactory.createWithoutLegalDetails(
        {
          countryCode: "US",
          citizenshipCountryCode: "US",
          invitedById: companyAdministrator.userId,
        },
        { withoutBankAccount: true },
      )
    ).user;

    await companyContractorsFactory.create(
      {
        companyId: company.id,
        userId: onboardingUser.id,
      },
      { withUnsignedContract: true },
    );
  });

  test("allows the contractor to fill in legal details", async ({ page }) => {
    await login(page, onboardingUser);

    await page.locator("label").filter({ hasText: "I'm an individual" }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByLabel("Residential address")).not.toBeValid();
    await expect(page.getByLabel("City")).not.toBeValid();
    await expect(page.getByLabel("State")).not.toBeValid();
    await expect(page.getByLabel("Zip code")).not.toBeValid();

    await fillInUSAddress(page);
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByText("Get Paid Fast")).toBeVisible();
  });

  test("allows for specifying a legal entity name for businesses", async ({ page }) => {
    await login(page, onboardingUser);

    await page.locator("label").filter({ hasText: "I'm a business" }).click();

    await fillInUSAddress(page);
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByLabel("Full legal name of entity")).not.toBeValid();

    await page.getByLabel("Full legal name of entity").fill("Antiwork Inc.");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByText("Get Paid Fast")).toBeVisible();
  });

  test.describe("when the contractor's company has the 'irs_tax_forms' flag enabled", () => {
    test.beforeEach(async () => {
      await db.update(companies).set({ irsTaxForms: true }).where(eq(companies.id, company.id));
    });

    test("allows to fill in legal details as an individual US citizen", async ({ page }) => {
      await login(page, onboardingUser);

      await page.locator("label").filter({ hasText: "I'm an individual" }).click();

      await fillInUSAddress(page);
      await page.getByLabel("Date of birth").fill("1980-06-07");
      await page.getByLabel("Tax identification number (SSN or ITIN)").fill("12345678");
      await page.getByRole("button", { name: "Continue" }).click();

      await expect(page.getByLabel("Tax identification number (SSN or ITIN)")).not.toBeValid();
      await expect(
        page.getByText("Your SSN or ITIN is too short. Make sure it contains 9 numerical characters"),
      ).toBeVisible();
      await expect(
        page.getByText("Please ensure this information matches the business name you used on your EIN application"),
      ).not.toBeVisible();

      await page.getByLabel("Tax identification number (SSN or ITIN)").fill("123456789");
      await expect(page.getByLabel("Tax identification number (SSN or ITIN)")).toHaveValue("123 - 45 - 6789");
      await page.getByRole("button", { name: "Continue" }).click();

      await withinModal(
        async (modal) => {
          await expect(modal.getByText("Consent for Electronic Delivery of Tax Forms")).toBeVisible();
          await modal.getByRole("button", { name: "Save" }).click();
        },
        { page, title: "W-9 Certification and Tax Forms Delivery" },
      );

      await expect(page.getByText("Get Paid Fast")).toBeVisible();

      expect(await fetchOnboardingUser()).toMatchObject({
        birthDate: "1980-06-07",
      });
      expect(await fetchOnboardingUserComplianceInfo()).toMatchObject({
        taxId: "123456789",
        taxInformationConfirmedAt: expect.any(Date),
      });
    });

    test("allows to fill in legal details as a US business", async ({ page }) => {
      await login(page, onboardingUser);

      await page.locator("label").filter({ hasText: "I'm a business" }).click();
      await page.getByLabel("Full legal name of entity").fill("Antiwork Inc.");

      await expect(
        page.getByText("Please ensure this information matches the business name you used on your EIN application"),
      ).toBeVisible();
      await expect(page.getByRole("link", { name: "EIN application" })).toHaveAttribute(
        "href",
        /^https:\/\/www\.irs\.gov\/businesses\/small-businesses-self-employed\/online-ein-frequently-asked-questions/u,
      );

      await fillInUSAddress(page);
      await page.getByLabel("Date of birth").fill("1980-06-07");

      await page.getByLabel("Tax identification number (EIN)").fill("123456789");
      await expect(page.getByLabel("Tax identification number (EIN)")).toHaveValue("12 - 3456789");

      await page.getByRole("button", { name: "Continue" }).click();

      await withinModal(
        async (modal) => {
          await expect(modal.getByText("Consent for Electronic Delivery of Tax Forms")).toBeVisible();
          await modal.getByRole("button", { name: "Save" }).click();
        },
        { page, title: "W-9 Certification and Tax Forms Delivery" },
      );

      await expect(page.getByText("Get Paid Fast")).toBeVisible();

      expect(await fetchOnboardingUser()).toMatchObject({
        birthDate: "1980-06-07",
      });
      expect(await fetchOnboardingUserComplianceInfo()).toMatchObject({
        taxId: "123456789",
        taxInformationConfirmedAt: expect.any(Date),
        businessEntity: true,
      });
    });

    test.describe("when the contractor is a foreigner", () => {
      test.beforeEach(async () => {
        await db
          .update(users)
          .set({ countryCode: "FR", citizenshipCountryCode: "IN" })
          .where(eq(users.id, onboardingUser.id));
      });

      test("allows to fill in legal details as an individual", async ({ page }) => {
        await login(page, onboardingUser);

        await page.locator("label").filter({ hasText: "I'm an individual" }).click();
        await fillInFranceAddress(page);

        await page.getByLabel("Foreign tax identification number").fill("1234567890");
        await page.getByLabel("Date of birth").fill("1980-06-07");
        await page.getByRole("button", { name: "Continue" }).click();

        await expect(page.getByLabel("Foreign tax identification number")).toHaveValue("1234567890");
        await expect(page.getByLabel("Foreign tax identification number")).toBeValid();
        await expect(
          page.getByText(
            "We use this for identity verification and tax reporting. Rest assured, your information is encrypted and securely stored",
          ),
        ).toBeVisible();
        await expect(
          page.getByText("Your SSN or ITIN is too short. Make sure it contains 9 numerical characters"),
        ).not.toBeVisible();

        await withinModal(
          async (modal) => {
            await expect(
              modal.getByText(
                "• I am the individual that is the beneficial owner (or am authorized to sign for the individual that is the beneficial owner) of all the income",
              ),
            ).toBeVisible();
            await expect(modal.getByText("Consent for Electronic Delivery of Tax Forms")).toBeVisible();
            await modal.getByRole("button", { name: "Save" }).click();
          },
          { page, title: "W-8BEN Certification and Tax Forms Delivery" },
        );

        await expect(page.getByText("Get Paid Fast")).toBeVisible();

        expect(await fetchOnboardingUser()).toMatchObject({
          birthDate: "1980-06-07",
        });
        expect(await fetchOnboardingUserComplianceInfo()).toMatchObject({
          taxId: "1234567890",
          taxInformationConfirmedAt: expect.any(Date),
        });
      });

      test("allows for specifying a legal entity name for businesses", async ({ page }) => {
        await login(page, onboardingUser);

        await page.locator("label").filter({ hasText: "I'm a business" }).click();

        await page.getByLabel("Full legal name of entity").fill("Antiwork Inc.");
        await fillInFranceAddress(page);
        await page.getByLabel("Foreign tax identification number").fill("1234567890");
        await page.getByLabel("Date of birth").fill("1980-06-07");

        await page.getByRole("button", { name: "Continue" }).click();

        await expect(page.getByLabel("Foreign tax identification number")).toBeValid();
        await expect(page.getByLabel("Foreign tax identification number")).toHaveValue("1234567890");
        await expect(
          page.getByText(
            "We use this for identity verification and tax reporting. Rest assured, your information is encrypted and securely stored",
          ),
        ).toBeVisible();
        await expect(
          page.getByText("Your EIN is too short. Make sure it contains 9 numerical characters"),
        ).not.toBeVisible();

        await withinModal(
          async (modal) => {
            await expect(
              modal.getByText(
                "• The entity identified on line 1 of this form is the beneficial owner of all the income or proceeds to which this form relates",
              ),
            ).toBeVisible();
            await expect(modal.getByText("Consent for Electronic Delivery of Tax Forms")).toBeVisible();
            await modal.getByRole("button", { name: "Save" }).click();
          },
          { page, title: "W-8BEN-E Certification and Tax Forms Delivery" },
        );

        await expect(page.getByText("Get Paid Fast")).toBeVisible();

        expect(await fetchOnboardingUser()).toMatchObject({
          birthDate: "1980-06-07",
        });
        expect(await fetchOnboardingUserComplianceInfo()).toMatchObject({
          taxId: "1234567890",
          taxInformationConfirmedAt: expect.any(Date),
          businessEntity: true,
        });
      });
    });
  });

  const fillInUSAddress = async (page: Page) => {
    await page.getByLabel("Residential address (street name, number, apartment)").fill("123 Main St");
    await page.getByLabel("City").fill("New York");
    await selectComboboxOption(page, "State", "New York");
    await page.getByLabel("Zip code").fill("12345");
  };

  const fillInFranceAddress = async (page: Page) => {
    await page.getByLabel("Residential address (street name, number, apartment)").fill("15 Rue de la Paix");
    await page.getByLabel("City").fill("Paris");
    await selectComboboxOption(page, "State", "Île-de-France");
    await page.getByLabel("Postal code").fill("75002");
  };

  const fetchOnboardingUser = () =>
    db.query.users.findFirst({
      where: eq(users.id, onboardingUser.id),
    });

  const fetchOnboardingUserComplianceInfo = () =>
    db.query.userComplianceInfos.findFirst({
      where: eq(userComplianceInfos.userId, onboardingUser.id),
    });
});
