import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";

test.describe("Impersonation", () => {
  test("impersonates and unimpersonates user via admin interface", async ({ page }) => {
    const { user: teamMember } = await usersFactory.create({ teamMember: true });
    const { user: targetUser } = await usersFactory.create();
    await login(page, teamMember);
    await page.goto("/admin/users");
    await page.getByText(targetUser.email).first().click();
    await page.getByRole("link", { name: "Impersonate" }).click();
    await page.waitForURL(/\/impersonate\?.*/u);
    await page.waitForURL(/\/invoices(\/.*)?$/u);
    await expect(page.getByRole("button", { name: "Stop impersonating" })).toBeVisible();
    await expect(page.getByText(targetUser.email)).toBeVisible();
    await page.getByRole("button", { name: "Stop impersonating" }).click();
    await page.waitForURL(/\/impersonate\?actor_token=null/u);
    await page.waitForURL(/\/invoices(\/.*)?$/u);
    await expect(page.getByRole("button", { name: "Stop impersonating" })).not.toBeVisible();
    await expect(page.getByText(teamMember.email)).toBeVisible();
  });

  test("redirects back to original account when impersonation expires", async ({ page }) => {
    const { user: teamMember } = await usersFactory.create({ teamMember: true });
    const { user: targetUser } = await usersFactory.create();
    await login(page, teamMember);
    await page.goto("/admin/users");
    await page.getByText(targetUser.email).first().click();
    await page.getByRole("link", { name: "Impersonate" }).click();
    await page.waitForURL(/\/impersonate\?.*/u);
    await page.waitForURL(/\/invoices(\/.*)?$/u);
    await expect(page.getByRole("button", { name: "Stop impersonating" })).toBeVisible();
    await expect(page.getByText(targetUser.email)).toBeVisible();
    await page.route("**/internal/**", (route) => route.fulfill({ status: 401, body: "Unauthorized" }));
    await page.goto("/dashboard");
    await page.waitForURL(/\/impersonate\?actor_token=null/u);
    await page.unroute("**/internal/**");
    await page.waitForURL(/\/invoices(\/.*)?$/u);
    await expect(page.getByRole("button", { name: "Stop impersonating" })).not.toBeVisible();
    await expect(page.getByText(teamMember.email)).toBeVisible();
  });

  test("cannot impersonate team members or non-existent users", async ({ page }) => {
    const { user: teamMember } = await usersFactory.create({ teamMember: true });
    const { user: anotherTeamMember } = await usersFactory.create({ teamMember: true });
    await login(page, teamMember);
    await page.goto("/admin/users");
    await page.getByText(anotherTeamMember.email).first().click();
    await page.getByRole("link", { name: "Impersonate" }).click();
    await page.waitForURL(/\/admin\/users/u);
    await expect(page.getByText("The requested resource could not be accessed")).toBeVisible();
    await page.goto("/admin/users/999999/impersonate");
    await page.waitForURL(/\/admin\/users/u);
    await expect(page.getByText("The requested resource could not be accessed")).toBeVisible();
    await page.getByText(teamMember.email).first().click();
    await expect(page.getByRole("link", { name: "Impersonate" })).not.toBeVisible();
    await page.goto(`/admin/users/${teamMember.id}/impersonate`);
    await page.waitForURL(/\/admin\/users/u);
    await expect(page.getByText("The requested resource could not be accessed")).toBeVisible();
  });
});
