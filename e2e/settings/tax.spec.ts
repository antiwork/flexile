import { db, takeOrThrow } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { userComplianceInfosFactory } from "@test/factories/userComplianceInfos";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { mockDocuseal } from "@test/helpers/docuseal";
import { expect, test } from "@test/index";
import { and, desc, eq, isNull } from "drizzle-orm";
import { BusinessType, DocumentType, TaxClassification } from "@/db/enums";
import { companies, documents, users } from "@/db/schema";
import { assertDefined } from "@/utils/assert";
import { selectComboboxOption, fillDatePicker } from "@test/helpers";

test.describe("Tax settings", () => {
  let company: typeof companies.$inferSelect;
  let adminUser: typeof users.$inferSelect;
  let user: typeof users.$inferSelect;

  test.beforeEach(async ({ page, next }) => {
    ({ company, adminUser } = await companiesFactory.createCompletedOnboarding());

    user = (
      await usersFactory.create(
        {
          legalName: "Caro Example",
          preferredName: "Caro",
          birthDate: "1980-06-27",
        },
        { withoutComplianceInfo: true },
      )
    ).user;
    const { mockForm } = mockDocuseal(next, {
      submitters: () => ({ "Company Representative": adminUser, Signer: user }),
    });
    await mockForm(page);
  });

  test.describe("as a contractor", () => {
    test.beforeEach(async () => {
      await companyContractorsFactory.create({ userId: user.id, companyId: company.id });
    });

    test("allows editing tax information", async ({ page, sentEmails }) => {
      await login(page, user);
      await page.goto("/settings/tax");
      await expect(
        page.getByText("These details will be included in your invoices and applicable tax forms."),
      ).toBeVisible();
      await expect(
        page.getByText(`Changes to your tax information may trigger a new contract with ${company.name}`),
      ).toBeVisible();
      await expect(page.getByText("Confirm your tax information")).toBeVisible();
      await expect(page.getByLabel("Individual")).toBeChecked();

      await expect(page.getByLabel("Country of residence")).toHaveText("United States");
      await selectComboboxOption(page, "Country of residence", "American Samoa");
      await expect(page.getByLabel("Province")).not.toBeEnabled();
      await selectComboboxOption(page, "Country of residence", "United Kingdom");
      await expect(page.getByLabel("Province")).toBeEnabled();
      await selectComboboxOption(page, "Country of residence", "United States");

      await page.getByLabel("Full legal name (must match your ID)").fill("Janet");
      await page.getByLabel("Tax ID (SSN or ITIN)").fill("");
      await page.getByLabel("Residential address (street name, number, apartment)").fill("");
      await page.getByLabel("City").fill("");
      await page.getByLabel("ZIP code").fill("");
      await page.getByRole("button", { name: "Save changes" }).click();

      await expect(page.getByText("This doesn't look like a complete full name.")).toBeVisible();
      await expect(page.getByLabel("Tax ID (SSN or ITIN)")).not.toBeValid();
      await expect(page.getByLabel("Residential address (street name, number, apartment)")).not.toBeValid();
      await expect(page.getByLabel("City")).not.toBeValid();
      await expect(page.getByLabel("ZIP code")).not.toBeValid();
      await page.getByLabel("Full legal name (must match your ID)").fill("Janet Flexile");
      await page.getByLabel("Residential address (street name, number, apartment)").fill("123 Grove St");
      await page.getByLabel("City").fill("Grove");
      await page.getByLabel("ZIP code").fill("12345");

      await page.getByLabel("Tax ID (SSN or ITIN)").fill("55566678");
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByText("Please check that your SSN or ITIN is 9 numbers long.")).toBeVisible();

      await page.locator("label").filter({ hasText: "Business" }).click();
      await expect(page.getByLabel("Type")).toBeValid();
      await expect(page.getByLabel("Tax classification")).not.toBeVisible();
      await selectComboboxOption(page, "Country of citizenship", "Mexico");
      await selectComboboxOption(page, "Country of incorporation", "United States");
      await page.getByLabel("Tax ID (EIN)").fill("111111111");

      await page.getByRole("button", { name: "Save changes" }).click();

      await expect(page.getByLabel("Business legal name")).not.toBeValid();
      await expect(page.getByText("Please select a business type.")).toBeVisible();

      await page.getByLabel("Business legal name").fill("Flexile Inc.");
      await selectComboboxOption(page, "Type", "LLC");

      await page.getByRole("button", { name: "Save changes" }).click();

      await expect(page.getByText("Please select a tax classification.")).toBeVisible();

      await selectComboboxOption(page, "Tax classification", "Partnership");
      await fillDatePicker(page, "Date of incorporation (optional)", "06/07/1980");
      await selectComboboxOption(page, "State", "New York");
      await page.getByRole("button", { name: "Save changes" }).click();

      await expect(page.getByText("Your EIN can't have all identical digits.")).toBeVisible();
      await page.getByLabel("Tax ID (EIN)").fill("55-5666789");
      await page.getByRole("button", { name: "Save changes" }).click();

      await expect(page.getByText("W-9 Certification and Tax Forms Delivery")).toBeVisible();
      await expect(page.getByLabel("Signature")).toHaveValue("Janet Flexile");

      await page.getByRole("button", { name: "Save", exact: true }).click();

      await expect(page.getByText("W-9 Certification and Tax Forms Delivery")).not.toBeVisible();

      const updatedUser = await db.query.users
        .findFirst({
          where: eq(users.id, user.id),
          with: {
            userComplianceInfos: true,
          },
        })
        .then(takeOrThrow);
      expect(updatedUser.userComplianceInfos).toHaveLength(1);

      expect(updatedUser.userComplianceInfos[0]?.taxInformationConfirmedAt).not.toBeNull();
      expect(updatedUser.userComplianceInfos[0]?.taxId).toBe("555666789");
      expect(updatedUser.userComplianceInfos[0]?.citizenshipCountryCode).toBe("MX");
      expect(updatedUser.userComplianceInfos[0]?.businessType).toBe(BusinessType.LLC);
      expect(updatedUser.userComplianceInfos[0]?.taxClassification).toBe(TaxClassification.Partnership);
      expect(updatedUser.userComplianceInfos[0]?.deletedAt).toBeNull();

      const document = await db.query.documents.findFirst({
        where: and(eq(documents.companyId, company.id), eq(documents.type, DocumentType.ConsultingContract)),
        orderBy: desc(documents.createdAt),
      });

      expect(sentEmails).toEqual([
        expect.objectContaining({
          to: adminUser.email,
          subject: `Caro has updated their tax information`,
          html: expect.stringContaining(`documents?sign=${assertDefined(document).id}`),
        }),
      ]);
    });

    test("allows searching for countries by name", async ({ page }) => {
      await login(page, user);
      await page.goto("/settings/tax");

      // Test partial country name search
      await page.getByRole("combobox", { name: "Country of citizenship" }).click();
      await page.getByPlaceholder("Search...").fill("polan");
      await expect(page.getByRole("option", { name: "Poland" })).toBeVisible();
      await page.getByRole("option", { name: "Poland" }).click();
      await expect(page.getByRole("combobox", { name: "Country of citizenship" })).toHaveText("Poland");

      // Test another partial search
      await page.getByRole("combobox", { name: "Country of residence" }).click();
      await page.getByPlaceholder("Search...").fill("united sta");
      await expect(page.getByRole("option", { name: "United States" })).toBeVisible();
      await expect(page.getByRole("option", { name: "United States Minor Outlying Islands" })).toBeVisible();
      await page.getByRole("option", { name: "United States" }).click();
      await expect(page.getByRole("combobox", { name: "Country of residence" })).toHaveText("United States");

      // Test case-insensitive search
      await page.getByRole("combobox", { name: "Country of citizenship" }).click();
      await page.getByPlaceholder("Search...").fill("CANADA");
      await expect(page.getByRole("option", { name: "Canada" })).toBeVisible();
      await page.getByRole("option", { name: "Canada" }).click();
      await expect(page.getByRole("combobox", { name: "Country of citizenship" })).toHaveText("Canada");

      // Test that country code still works
      await page.getByRole("combobox", { name: "Country of residence" }).click();
      await page.getByPlaceholder("Search...").fill("GB");
      await expect(page.getByRole("option", { name: "United Kingdom" })).toBeVisible();
      await page.getByRole("option", { name: "United Kingdom" }).click();
      await expect(page.getByRole("combobox", { name: "Country of residence" })).toHaveText("United Kingdom");
    });

    test("allows confirming tax information", async ({ page }) => {
      await userComplianceInfosFactory.create({ userId: user.id });
      await login(page, user);
      await page.goto("/settings/tax");

      await expect(page.getByText("Confirm your tax information")).toBeVisible();

      await page.getByLabel("Tax ID").fill("123456789");
      await page.getByRole("button", { name: "Save changes" }).click();

      await expect(page.getByText("W-9 Certification and Tax Forms Delivery")).toBeVisible();
      await expect(page.getByLabel("Signature")).toHaveValue("Caro Example");

      await page.getByRole("button", { name: "Save", exact: true }).click();

      await expect(page.getByText("W-9 Certification and Tax Forms Delivery")).not.toBeVisible();

      const updatedUser = await db.query.users
        .findFirst({
          where: eq(users.id, user.id),
          with: {
            userComplianceInfos: true,
          },
        })
        .then(takeOrThrow);
      expect(updatedUser.userComplianceInfos).toHaveLength(2);

      expect(updatedUser.userComplianceInfos[0]?.deletedAt).not.toBeNull();

      expect(updatedUser.userComplianceInfos[1]?.taxInformationConfirmedAt).not.toBeNull();
      expect(updatedUser.userComplianceInfos[1]?.deletedAt).toBeNull();
    });

    // TODO (techdebt): Add the quickbooks tests from spec/system/settings/tax_spec.rb

    test.describe("tax ID validity", () => {
      test.describe("for US residents", () => {
        test("shows pending status", async ({ page }) => {
          await userComplianceInfosFactory.create({ userId: user.id });
          await login(page, user);
          await page.goto("/settings/tax");

          await expect(page.getByText("VERIFYING")).toBeVisible();
          await expect(page.getByText("Review your tax information")).not.toBeVisible();
        });

        test("shows verified status", async ({ page }) => {
          await userComplianceInfosFactory.create({ userId: user.id, taxIdStatus: "verified" });

          await login(page, user);
          await page.goto("/settings/tax");

          await expect(page.getByText("VERIFIED")).toBeVisible();
          await expect(page.getByText("Review your tax information")).not.toBeVisible();
        });

        test("shows invalid status", async ({ page }) => {
          await userComplianceInfosFactory.create({ userId: user.id, taxIdStatus: "invalid" });

          await login(page, user);
          await page.goto("/settings/tax");

          await expect(page.getByText("INVALID")).toBeVisible();
          await expect(page.getByText("Review your tax information")).toBeVisible();
        });

        test("hides status when tax ID input changes", async ({ page }) => {
          await userComplianceInfosFactory.create({ userId: user.id, taxIdStatus: "verified" });

          await login(page, user);
          await page.goto("/settings/tax");

          await expect(page.getByText("VERIFIED")).toBeVisible();
          await page.getByLabel("Tax ID (SSN or ITIN)").fill("987-65-4321");
          await expect(page.getByText("VERIFIED")).not.toBeVisible();
          await expect(page.getByText("VERIFYING")).not.toBeVisible();
          await expect(page.getByText("INVALID")).not.toBeVisible();
        });
      });

      test("does not show the TIN status for investors outside of the US", async ({ page }) => {
        await db.update(users).set({ countryCode: "AT", citizenshipCountryCode: "AT" }).where(eq(users.id, user.id));

        await login(page, user);
        await page.goto("/settings/tax");

        await expect(page.getByText("Foreign tax ID")).toBeVisible();
        await expect(page.getByText("PENDING")).not.toBeVisible();
        await expect(page.getByText("Review your tax information")).not.toBeVisible();
      });

      test("only requires setting a business type for US citizens", async ({ page, sentEmails: _ }) => {
        await db.update(users).set({ countryCode: "GB", citizenshipCountryCode: "GB" }).where(eq(users.id, user.id));

        await login(page, user);
        await page.goto("/settings/tax");

        await page.locator("label").filter({ hasText: "Business" }).click();
        await page.getByLabel("Business legal name").fill("Test Business LLC");
        await page.getByLabel("Foreign tax ID").fill("123456789");
        await page.getByLabel("Full legal name (must match your ID)").fill("John Smith");
        await expect(page.getByLabel("Type")).not.toBeVisible();
        await page.getByRole("button", { name: "Save changes" }).click();
        await expect(page.getByText("W-8BEN-E Certification and Tax Forms Delivery")).toBeVisible();
        await page.waitForTimeout(100);
        await page.getByRole("button", { name: "Save", exact: true }).click();
        await expect(page.getByText("W-8BEN-E Certification and Tax Forms Delivery")).not.toBeVisible();
        await page.goto("/settings/tax", { waitUntil: "load" });

        await selectComboboxOption(page, "Country of citizenship", "United States");
        await selectComboboxOption(page, "Country of incorporation", "United States");

        await selectComboboxOption(page, "Type", "LLC");
        await selectComboboxOption(page, "Tax classification", "Partnership");
        await page.getByRole("button", { name: "Save changes" }).click();

        await page.getByLabel("Full legal name (must match your ID)").fill("John Smith");
        await expect(page.getByText("W-9 Certification and Tax Forms Delivery")).toBeVisible();
        await page.getByRole("button", { name: "Save", exact: true }).click();
      });

      test("allows US citizen in Australia to set a 4-digit postal code", async ({ page, sentEmails }) => {
        await db.update(users).set({ countryCode: "AU", citizenshipCountryCode: "US" }).where(eq(users.id, user.id));

        await login(page, user);
        await page.goto("/settings/tax");

        await page.getByLabel("Full legal name (must match your ID)").fill("John Smith");
        await page.getByLabel("Tax ID (SSN or ITIN)").fill("987-65-4321");
        await page.getByLabel("Residential address (street name, number, apartment)").fill("123 Sydney St");
        await page.getByLabel("City").fill("Sydney");
        if (await page.getByLabel("Province").isEnabled())
          await selectComboboxOption(page, "Province", "New South Wales");

        await page.getByLabel("Postal code").fill("1234");
        await page.getByRole("button", { name: "Save changes" }).click();
        await expect(page.getByText("W-9 Certification and Tax Forms Delivery")).toBeVisible();

        await page.getByRole("button", { name: "Save", exact: true }).click();

        await expect(page.getByText("W-9 Certification and Tax Forms Delivery")).not.toBeVisible();

        const updatedUser = await db.query.users
          .findFirst({
            where: eq(users.id, user.id),
            with: {
              userComplianceInfos: true,
            },
          })
          .then(takeOrThrow);
        expect(updatedUser.userComplianceInfos).toHaveLength(1);

        expect(updatedUser.userComplianceInfos[0]?.taxInformationConfirmedAt).not.toBeNull();
        expect(updatedUser.userComplianceInfos[0]?.deletedAt).toBeNull();
        expect(updatedUser.userComplianceInfos[0]?.zipCode).toBe("1234");

        const document = await db.query.documents.findFirst({
          where: and(
            eq(documents.companyId, company.id),
            eq(documents.type, DocumentType.ConsultingContract),
            isNull(documents.deletedAt),
          ),
          orderBy: desc(documents.createdAt),
        });

        expect(sentEmails).toEqual([
          expect.objectContaining({
            to: adminUser.email,
            subject: `Caro has updated their tax information`,
            html: expect.stringContaining(`documents?sign=${assertDefined(document).id}`),
          }),
        ]);
      });
    });

    test("does not show the TIN verification status with none set", async ({ page }) => {
      await login(page, user);
      await page.goto("/settings/tax");

      await expect(page.getByLabel("Tax ID (SSN or ITIN)")).toHaveValue("");
    });

    test("preserves foreign tax ID format", async ({ page, sentEmails }) => {
      await db.update(users).set({ countryCode: "DE", citizenshipCountryCode: "DE" }).where(eq(users.id, user.id));

      await login(page, user);
      await page.goto("/settings/tax");

      await expect(page.getByText("Foreign tax ID")).toBeVisible();

      const foreignTaxId = "DE123456789";
      await page.getByLabel("Foreign tax ID").fill(foreignTaxId);

      await expect(page.getByLabel("Foreign tax ID")).toHaveValue(foreignTaxId);

      await page.getByLabel("Full legal name (must match your ID)").fill("Hans Schmidt");
      await page.getByLabel("Residential address (street name, number, apartment)").fill("123 Berlin St");
      await page.getByLabel("City").fill("Berlin");
      await selectComboboxOption(page, "Province", "Berlin");
      await page.getByLabel("Postal code").fill("10115");

      await page.getByRole("button", { name: "Save changes" }).click();

      await expect(page.getByText("W-8BEN Certification and Tax Forms Delivery")).toBeVisible();
      await page.getByRole("button", { name: "Save", exact: true }).click();

      await expect(page.getByText("W-8BEN Certification and Tax Forms Delivery")).not.toBeVisible();

      const updatedUser = await db.query.users
        .findFirst({
          where: eq(users.id, user.id),
          with: {
            userComplianceInfos: true,
          },
        })
        .then(takeOrThrow);
      expect(updatedUser.userComplianceInfos).toHaveLength(1);

      expect(updatedUser.userComplianceInfos[0]?.taxInformationConfirmedAt).not.toBeNull();
      expect(updatedUser.userComplianceInfos[0]?.deletedAt).toBeNull();
      expect(updatedUser.userComplianceInfos[0]?.taxId).toBe("DE123456789");
      expect(sentEmails.length).toBe(1);
    });

    test("formats US tax IDs correctly", async ({ page }) => {
      await db.update(users).set({ countryCode: "US", citizenshipCountryCode: "US" }).where(eq(users.id, user.id));

      await login(page, user);
      await page.goto("/settings/tax");

      await expect(page.getByLabel("Individual")).toBeChecked();

      await page.getByLabel("Tax ID (SSN or ITIN)").fill("123456789");

      await expect(page.getByLabel("Tax ID (SSN or ITIN)")).toHaveValue("123-45-6789");

      await page.getByLabel("Tax ID (SSN or ITIN)").fill("123");
      await expect(page.getByLabel("Tax ID (SSN or ITIN)")).toHaveValue("123");

      await page.getByLabel("Tax ID (SSN or ITIN)").fill("12345");
      await expect(page.getByLabel("Tax ID (SSN or ITIN)")).toHaveValue("123-45");

      await page.locator("label").filter({ hasText: "Business" }).click();
      await page.getByLabel("Business legal name").fill("Test Business LLC");
      await selectComboboxOption(page, "Type", "LLC");
      await selectComboboxOption(page, "Tax classification", "Partnership");

      await page.getByLabel("Tax ID (EIN)").fill("123456789");

      await expect(page.getByLabel("Tax ID (EIN)")).toHaveValue("12-3456789");

      await page.getByLabel("Tax ID (EIN)").fill("12");
      await expect(page.getByLabel("Tax ID (EIN)")).toHaveValue("12");

      await page.getByLabel("Tax ID (EIN)").fill("123456");
      await expect(page.getByLabel("Tax ID (EIN)")).toHaveValue("12-3456");
    });

    test("handles country change correctly for tax ID formatting", async ({ page }) => {
      await db.update(users).set({ countryCode: "US", citizenshipCountryCode: "US" }).where(eq(users.id, user.id));

      await login(page, user);
      await page.goto("/settings/tax");

      await page.getByLabel("Tax ID (SSN or ITIN)").fill("123456789");
      await expect(page.getByLabel("Tax ID (SSN or ITIN)")).toHaveValue("123-45-6789");

      await selectComboboxOption(page, "Country of citizenship", "Germany");
      await selectComboboxOption(page, "Country of residence", "Germany");

      await expect(page.getByText("Foreign tax ID")).toBeVisible();

      await expect(page.getByLabel("Foreign tax ID")).toHaveValue("123456789");

      await page.getByLabel("Foreign tax ID").fill("DE-123/456.789");
      await expect(page.getByLabel("Foreign tax ID")).toHaveValue("DE123456789");

      await selectComboboxOption(page, "Country of citizenship", "United States");
      await selectComboboxOption(page, "Country of residence", "United States");

      await expect(page.getByText("Tax ID (SSN or ITIN)")).toBeVisible();

      await expect(page.getByLabel("Tax ID (SSN or ITIN)")).toHaveValue("123-45-6789");
    });

    test("allows legal names with two spaces", async ({ page, sentEmails: _ }) => {
      await login(page, user);
      await page.goto("/settings/tax");

      await page.getByLabel("Full legal name (must match your ID)").fill("John Middle Doe");
      await page.getByLabel("Tax ID (SSN or ITIN)").fill("123456789");

      await page.getByRole("button", { name: "Save changes" }).click();
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.getByText("W-9 Certification and Tax Forms Delivery")).not.toBeVisible();

      const updatedUser = await db.query.users.findFirst({ where: eq(users.id, user.id) }).then(takeOrThrow);
      expect(updatedUser.legalName).toBe("John Middle Doe");
    });
  });

  test.describe("as an investor", () => {
    test.beforeEach(async () => {
      await companyInvestorsFactory.create({ userId: user.id, companyId: company.id });
    });

    test("shows the correct text", async ({ page }) => {
      await login(page, user);
      await page.goto("/settings/tax");

      await expect(page.getByText("These details will be included in your applicable tax forms.")).toBeVisible();
      await expect(page.getByText("Changes to your tax information may trigger a new contract.")).not.toBeVisible();
    });
  });
});
