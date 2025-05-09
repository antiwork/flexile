import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test, withinModal } from "@test/index";

test.describe("Adding bank account after onboarding", () => {
  test("allows contractor to add a new bank account after onboarding", async ({ page, next }) => {
    next.onFetch(async (request) => {
      if (request.url.includes("stripe.com/v1/financial_connections/sessions")) {
        return Response.json({
          id: "fcsess_123",
          client_secret: "secret_123",
          url: "https://stripe.com/connect",
        });
      }
    });
    
    const { company } = await companiesFactory.createCompletedOnboarding();
    const { user } = await usersFactory.create();
    
    await companyContractorsFactory.create({
      companyId: company.id,
      userId: user.id,
    });
    
    await login(page, user);
    
    await page.goto("/settings/payouts");
    
    await expect(page.getByText("Payout method")).toBeVisible();
    
    await expect(page.getByRole("button", { name: "Add bank account" })).toBeVisible();
    await page.getByRole("button", { name: "Add bank account" }).click();
    
    await withinModal(
      async (modal) => {
        await expect(modal.getByText("Connect your bank account")).toBeVisible();
        await modal.getByRole("button", { name: "Connect bank account" }).click();
      },
      { page },
    );
    
    await page.reload();
    
    await expect(page.getByText("Payout method")).toBeVisible();
    await expect(page.getByText("Bank account connected")).toBeVisible();
  });
});
