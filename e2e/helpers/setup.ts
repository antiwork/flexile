import type { Page } from "@playwright/test";
import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { companyStripeAccountsFactory } from "@test/factories/companyStripeAccounts";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";

export const setupContractorWithCompany = async (
  page: Page,
  options?: {
    payRateInSubunits?: number;
    withBankAccount?: boolean;
  },
) => {
  const { company } = await companiesFactory.createCompletedOnboarding();
  const { user: contractorUser } = await usersFactory.create();

  const { companyContractor } = await companyContractorsFactory.create({
    companyId: company.id,
    userId: contractorUser.id,
    payRateInSubunits: options?.payRateInSubunits || 5000,
  });

  if (options?.withBankAccount !== false) {
    await companyStripeAccountsFactory.create({
      companyId: company.id,
      status: "ready",
      bankAccountLastFour: "4321",
    });
  }

  await login(page, contractorUser);

  return { company, contractorUser, companyContractor };
};

export const setupAdminWithCompany = async (page: Page) => {
  const { company, adminUser } = await companiesFactory.createCompletedOnboarding();
  await login(page, adminUser);
  return { company, adminUser };
};

export const navigateToDashboard = async (page: Page) => {
  await page.goto("/dashboard");
  await page.waitForLoadState("domcontentloaded");
};
