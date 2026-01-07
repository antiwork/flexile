import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";

test.describe("Impersonation", () => {
  test("impersonates via UI", async ({ page }) => {
    const { user: teamMember } = await usersFactory.create({ teamMember: true });
    const { user } = await usersFactory.create();

    await login(page, teamMember, "/admin/users");

    await page.getByRole("searchbox").fill(user.email);
    await page.getByRole("searchbox").press("Enter");
    await page.getByText(user.email).click();

    await page.getByRole("link", { name: "Become" }).click();
    await expect(page.getByText(user.email)).toBeVisible();

    await page.getByRole("button", { name: "Unbecome" }).click();
    await expect(page).toHaveURL(/\/admin$/u);

    await page.goto("/dashboard");
    await expect(page.getByText(teamMember.email)).toBeVisible();
  });

  // Useful when URL is opened directly in browser, e.g. by Helper.ai
  test("impersonates via direct URL", async ({ page }) => {
    const { user: teamMember } = await usersFactory.create({ teamMember: true });
    const { user } = await usersFactory.create();

    await login(page, teamMember, `/admin/users/${user.externalId}/impersonate`);
    await expect(page.getByText(user.email)).toBeVisible();
  });

  test("does not impersonate team members or non-existent users", async ({ page }) => {
    const { user: teamMember } = await usersFactory.create({ teamMember: true });
    const { user: anotherTeamMember } = await usersFactory.create({ teamMember: true });

    await login(page, teamMember, "/admin/users");

    await page.getByRole("searchbox").fill(anotherTeamMember.email);
    await page.getByRole("searchbox").press("Enter");
    await page.getByText(anotherTeamMember.email).click();

    await expect(page.getByRole("link", { name: "Become" })).not.toBeVisible();

    await page.goto("/admin/users/999999/impersonate");
    await expect(page.getByText("The requested resource could not be accessed.")).toBeVisible();
  });
});
