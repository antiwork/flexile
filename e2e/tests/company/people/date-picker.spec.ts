import { companiesFactory } from "@test/factories/companies";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test, withinModal } from "@test/index";

test("can select start date with date picker", async ({ page }) => {
  const { company, adminUser } = await companiesFactory.createCompletedOnboarding();
  const workerUser = (await usersFactory.create()).user;
  await login(page, adminUser);
  await page.goto("/people");
  await page.getByRole("button", { name: "Add contractor" }).click();
  await withinModal(
    async (modal) => {
      await modal.getByLabel("Email").fill(workerUser.email);
      await modal.getByRole("button", { name: "Calendar" }).click();
      await modal.getByRole("gridcell", { name: "15" }).first().click();
      await expect(modal.getByRole("group", { name: "Start date" })).toContainText("15");
    },
    { page, title: "Who's joining?" },
  );
});

