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
import { companies, documents, userComplianceInfos, users } from "@/db/schema";
import { assertDefined } from "@/utils/assert";

test.describe("Tax settings", () => {
  let company: typeof companies.$inferSelect;
  let adminUser: typeof users.$inferSelect;
  let user: typeof users.$inferSelect;
  let userComplianceInfo: typeof userComplianceInfos.$inferSelect;

  test.beforeEach(async ({ page, next }) => {
    ({ company, adminUser } = await companiesFactory.createCompletedOnboarding({ irsTaxForms: true }));

    user = (
      await usersFactory.createWithoutComplianceInfo({
        legalName: "Caro Example",
        preferredName: "Caro",
        birthDate: "1980-06-27",
      })
    ).user;
    userComplianceInfo = (
      await userComplianceInfosFactory.create({
        userId: user.id,
        taxId: "123-45-6789",
      })
    ).userComplianceInfo;
    await login(page, user);
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
      await page.goto("/settings/tax");
      await expect(
        page.getByText("These details will be included in your invoices and applicable tax forms."),
      ).toBeVisible();
      await expect(
        page.getByText(`Changes to your tax information may trigger a new contract with ${company.name}`),
      ).toBeVisible();

      await page.getByLabel("Country of citizenship").selectOption("MX");
      await expect(page.getByText("Confirm your tax information")).toBeVisible();
      await expect(page.getByLabel("Individual")).toBeChecked();
      await expect(page.getByLabel("Country of residence")).toHaveValue("US");

      await page.getByLabel("Full legal name (must match your ID)").fill("Janet");
      await page.getByLabel("Tax ID (SSN or ITIN)").fill("");
      await page.getByLabel("Residential address (street name, number, apartment)").fill("");
      await page.getByLabel("City").fill("");
      await page.getByLabel("ZIP code").fill("");
      await page.getByRole("button", { name: "Save changes" }).click();

      await expect(page.getByText("This doesn't look like a complete full name.")).toBeVisible();
      await expect(page.getByText("Please add your SSN or ITIN.")).toBeVisible();
      await expect(page.getByText("Please add your residential address.")).toBeVisible();
      await expect(page.getByText("Please add your city or town.")).toBeVisible();
      await expect(page.getByText("Please add a valid ZIP code (5 or 9 digits).")).toBeVisible();

      await page.getByLabel("Tax ID (SSN or ITIN)").fill("55566678");
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByText("Please check that your SSN or ITIN is 9 numbers long.")).toBeVisible();

      await page.getByLabel("Country of residence").selectOption("GB");
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByLabel("Province")).toBeEnabled();

      await page.getByLabel("Country of residence").selectOption("AS");
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByLabel("Province")).not.toBeEnabled();
      await page.getByLabel("Country of citizenship").selectOption("AS");

      await page.getByRole("radio", { name: "Business" }).check();
      await expect(page.getByText("Please select a business type.")).not.toBeVisible();
      await expect(page.getByText("Please select a tax classification.")).not.toBeVisible();
      await page.getByLabel("Country of citizenship").selectOption("MX");
      await page.getByLabel("Country of incorporation").selectOption("US");
      await page.getByLabel("Tax ID (EIN)").fill("111111111");

      await page.getByRole("button", { name: "Save changes" }).click();

      await expect(page.getByText("Please add your business legal name.")).toBeVisible();
      await expect(page.getByText("Your EIN can't have all identical digits.")).toBeVisible();

      await page.getByLabel("Business legal name").fill("Flexile Inc.");
      await page.getByRole("button", { name: "Save changes" }).click();

      await expect(page.getByText("Please select a business type.")).toBeVisible();

      await page.getByRole("button", { name: "Save changes" }).click();
      await page.getByLabel("Type").selectOption(BusinessType.LLC.toString());
      await page.getByRole("button", { name: "Save changes" }).click();

      await expect(page.getByText("Please select a tax classification.")).toBeVisible();

      await page.getByRole("button", { name: "Save changes" }).click();

      await page.getByLabel("Full legal name (must match your ID)").fill("Janet Flexile");
      await page.getByLabel("Business legal name").fill("Flexile Inc.");
      await page.getByLabel("Tax classification").selectOption(TaxClassification.Partnership.toString());
      await page.getByLabel("Tax ID (EIN)").fill("55-5666789");
      await page.getByLabel("Date of incorporation (optional)").fill("1980-06-07");
      await page.getByLabel("Residential address (street name, number, apartment)").fill("123 Grove St");
      await page.getByLabel("State").selectOption("New York");
      await page.getByLabel("City").fill("New York");
      await page.getByLabel("ZIP code").fill("10001");
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
      expect(updatedUser.userComplianceInfos).toHaveLength(2);

      expect(updatedUser.userComplianceInfos[0]?.deletedAt).not.toBeNull();

      expect(updatedUser.userComplianceInfos[1]?.taxInformationConfirmedAt).not.toBeNull();
      expect(updatedUser.userComplianceInfos[1]?.taxId).toBe("555666789");
      expect(updatedUser.userComplianceInfos[1]?.citizenshipCountryCode).toBe("MX");
      expect(updatedUser.userComplianceInfos[1]?.businessType).toBe(BusinessType.LLC);
      expect(updatedUser.userComplianceInfos[1]?.taxClassification).toBe(TaxClassification.Partnership);
      expect(updatedUser.userComplianceInfos[1]?.deletedAt).toBeNull();

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

    test("allows confirming tax information", async ({ page }) => {
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
          await page.goto("/settings/tax");

          await expect(page.getByText("VERIFYING")).toBeVisible();
          await expect(page.getByText("Review your tax information")).not.toBeVisible();
        });

        test("shows verified status", async ({ page }) => {
          await db
            .update(userComplianceInfos)
            .set({ taxIdStatus: "verified" })
            .where(eq(userComplianceInfos.id, userComplianceInfo.id));

          await page.goto("/settings/tax");

          await expect(page.getByText("VERIFIED")).toBeVisible();
          await expect(page.getByText("Review your tax information")).not.toBeVisible();
        });

        test("shows invalid status", async ({ page }) => {
          await db
            .update(userComplianceInfos)
            .set({ taxIdStatus: "invalid" })
            .where(eq(userComplianceInfos.id, userComplianceInfo.id));

          await page.goto("/settings/tax");

          await expect(page.getByText("INVALID")).toBeVisible();
          await expect(page.getByText("Review your tax information")).toBeVisible();
        });

        test("hides status when tax ID input changes", async ({ page }) => {
          await db
            .update(userComplianceInfos)
            .set({ taxIdStatus: "verified" })
            .where(eq(userComplianceInfos.id, userComplianceInfo.id));

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

        await page.goto("/settings/tax");

        await expect(page.getByText("Foreign tax ID")).toBeVisible();
        await expect(page.getByText("PENDING")).not.toBeVisible();
        await expect(page.getByText("Review your tax information")).not.toBeVisible();
      });

      test("allows US citizen in Australia to set a 4-digit postal code", async ({ page, sentEmails }) => {
        await db.update(users).set({ countryCode: "AU", citizenshipCountryCode: "US" }).where(eq(users.id, user.id));

        await page.goto("/settings/tax");

        await page.getByLabel("Full legal name (must match your ID)").fill("John Smith");
        await page.getByLabel("Tax ID (SSN or ITIN)").fill("987-65-4321");
        await page.getByLabel("Residential address (street name, number, apartment)").fill("123 Sydney St");
        await page.getByLabel("City").fill("Sydney");
        if (await page.getByLabel("Province").isEnabled())
          await page.getByLabel("Province").selectOption("New South Wales");

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
        expect(updatedUser.userComplianceInfos).toHaveLength(2);

        expect(updatedUser.userComplianceInfos[0]?.deletedAt).not.toBeNull();

        expect(updatedUser.userComplianceInfos[1]?.taxInformationConfirmedAt).not.toBeNull();
        expect(updatedUser.userComplianceInfos[1]?.deletedAt).toBeNull();
        expect(updatedUser.userComplianceInfos[1]?.zipCode).toBe("1234");

        const document = await db.query.documents.findFirst({
          where: and(
            eq(documents.companyId, company.id),
            eq(documents.userId, user.id),
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
      await db
        .update(userComplianceInfos)
        .set({ taxId: null })
        .where(eq(userComplianceInfos.id, userComplianceInfo.id));

      await page.goto("/settings/tax");

      await expect(page.getByLabel("Tax ID (SSN or ITIN)")).toHaveValue("");
    });

    test("preserves foreign tax ID format", async ({ page, sentEmails }) => {
      await db.update(users).set({ countryCode: "DE", citizenshipCountryCode: "DE" }).where(eq(users.id, user.id));

      await page.goto("/settings/tax");

      await expect(page.getByText("Foreign tax ID")).toBeVisible();

      const foreignTaxId = "DE123456789";
      await page.getByLabel("Foreign tax ID").fill(foreignTaxId);

      await expect(page.getByLabel("Foreign tax ID")).toHaveValue(foreignTaxId);

      await page.getByLabel("Full legal name (must match your ID)").fill("Hans Schmidt");
      await page.getByLabel("Residential address (street name, number, apartment)").fill("123 Berlin St");
      await page.getByLabel("City").fill("Berlin");
      await page.getByLabel("Province").selectOption("Berlin");
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
      expect(updatedUser.userComplianceInfos).toHaveLength(2);

      expect(updatedUser.userComplianceInfos[0]?.deletedAt).not.toBeNull();

      expect(updatedUser.userComplianceInfos[1]?.taxInformationConfirmedAt).not.toBeNull();
      expect(updatedUser.userComplianceInfos[1]?.deletedAt).toBeNull();
      expect(updatedUser.userComplianceInfos[1]?.taxId).toBe("DE123456789");
      expect(sentEmails.length).toBe(1);
    });

    test("formats US tax IDs correctly", async ({ page }) => {
      await db.update(users).set({ countryCode: "US", citizenshipCountryCode: "US" }).where(eq(users.id, user.id));

      await page.goto("/settings/tax");

      await expect(page.getByLabel("Individual")).toBeChecked();

      await page.getByLabel("Tax ID (SSN or ITIN)").fill("123456789");

      await expect(page.getByLabel("Tax ID (SSN or ITIN)")).toHaveValue("123-45-6789");

      await page.getByLabel("Tax ID (SSN or ITIN)").fill("123");
      await expect(page.getByLabel("Tax ID (SSN or ITIN)")).toHaveValue("123");

      await page.getByLabel("Tax ID (SSN or ITIN)").fill("12345");
      await expect(page.getByLabel("Tax ID (SSN or ITIN)")).toHaveValue("123-45");

      await page.getByRole("radio", { name: "Business" }).check();
      await page.getByLabel("Business legal name").fill("Test Business LLC");
      await page.getByLabel("Type").selectOption(BusinessType.LLC.toString());
      await page.getByLabel("Tax classification").selectOption(TaxClassification.Partnership.toString());

      await page.getByLabel("Tax ID (EIN)").fill("123456789");

      await expect(page.getByLabel("Tax ID (EIN)")).toHaveValue("12-3456789");

      await page.getByLabel("Tax ID (EIN)").fill("12");
      await expect(page.getByLabel("Tax ID (EIN)")).toHaveValue("12");

      await page.getByLabel("Tax ID (EIN)").fill("123456");
      await expect(page.getByLabel("Tax ID (EIN)")).toHaveValue("12-3456");
    });

    test("handles country change correctly for tax ID formatting", async ({ page }) => {
      await db.update(users).set({ countryCode: "US", citizenshipCountryCode: "US" }).where(eq(users.id, user.id));

      await page.goto("/settings/tax");

      await page.getByLabel("Tax ID (SSN or ITIN)").fill("123456789");
      await expect(page.getByLabel("Tax ID (SSN or ITIN)")).toHaveValue("123-45-6789");

      await page.getByLabel("Country of citizenship").selectOption("DE");
      await page.getByLabel("Country of residence").selectOption("DE");

      await expect(page.getByText("Foreign tax ID")).toBeVisible();

      await expect(page.getByLabel("Foreign tax ID")).toHaveValue("123456789");

      await page.getByLabel("Foreign tax ID").fill("DE-123/456.789");
      await expect(page.getByLabel("Foreign tax ID")).toHaveValue("DE123456789");

      await page.getByLabel("Country of citizenship").selectOption("US");
      await page.getByLabel("Country of residence").selectOption("US");

      await expect(page.getByText("Tax ID (SSN or ITIN)")).toBeVisible();

      await expect(page.getByLabel("Tax ID (SSN or ITIN)")).toHaveValue("123-45-6789");
    });
  });

  test.describe("as an investor", () => {
    test.beforeEach(async () => {
      await companyInvestorsFactory.create({ userId: user.id, companyId: company.id });
    });

    test("shows the correct text", async ({ page }) => {
      await page.goto("/settings/tax");

      await expect(page.getByText("These details will be included in your applicable tax forms.")).toBeVisible();
      await expect(page.getByText("Changes to your tax information may trigger a new contract.")).not.toBeVisible();
    });
  });
});
