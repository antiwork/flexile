import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";

test.describe("Impersonation", () => {
  test("allows admin to impersonate and unimpersonate a user via UI", async ({ page }) => {
    const { user: teamMember } = await usersFactory.create({ teamMember: true });
    const { user } = await usersFactory.create();

    await login(page, teamMember, "/admin/users");

    await page.getByText(user.email).first().click();
    await page.getByRole("link", { name: "Become" }).click();
    await expect(page.getByText(user.email)).toBeVisible();

    await page.getByRole("button", { name: "Unbecome" }).click();
    await expect(page).toHaveURL(/\/admin$/u);

    await page.goto("/dashboard");
    await expect(page.getByText(teamMember.email)).toBeVisible();
  });

  // useful for external tools like Helper.ai
  test("allows impersonation via direct URL after login", async ({ page }) => {
    const { user: teamMember } = await usersFactory.create({ teamMember: true });
    const { user } = await usersFactory.create();

    await login(page, teamMember, `/admin/users/${user.externalId}/impersonate`);
    await expect(page.getByText(user.email)).toBeVisible();
  });

  test("prevents impersonation of team members or non-existent users", async ({ page }) => {
    const { user: teamMember } = await usersFactory.create({ teamMember: true });
    const { user: anotherTeamMember } = await usersFactory.create({ teamMember: true });

    await login(page, teamMember, "/admin/users");

    // prevents impersonating team member
    await page.getByText(anotherTeamMember.email).first().click();
    await expect(page.getByRole("link", { name: "Become" })).not.toBeVisible();

    // prevents impersonating non-existent user
    await page.goto("/admin/users/999999/impersonate");
    await expect(page.getByText("The requested resource could not be accessed.")).toBeVisible();
  });
});
