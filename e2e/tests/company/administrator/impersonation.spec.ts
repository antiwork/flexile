import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";

test.describe("Impersonation", () => {
  test("impersonates and unimpersonates user", async ({ page }) => {
    const { user: teamMember } = await usersFactory.create({ teamMember: true });
    const { user: targetUser } = await usersFactory.create();
    await login(page, teamMember, "/admin");
    await page.getByPlaceholder("Enter user email").fill(targetUser.email);
    await page.getByRole("button", { name: "Impersonate user" }).click();
    await page.waitForURL(/\/impersonate\?.*/u);
    await page.waitForURL(/\/invoices(\/.*)?$/u);
    await expect(page.getByRole("button", { name: "Stop impersonating" })).toBeVisible();
    await expect(page.getByText(targetUser.email)).toBeVisible();
    await page.getByRole("button", { name: "Stop impersonating" }).click();
    await page.waitForURL(/\/impersonate\?.*/u);
    await page.waitForURL(/\/invoices(\/.*)?$/u);
    await expect(page.getByRole("button", { name: "Stop impersonating" })).not.toBeVisible();
    await expect(page.getByText(teamMember.email)).toBeVisible();
  });

  test("redirects back to original account when impersonation expires", async ({ page }) => {
    const { user: teamMember } = await usersFactory.create({ teamMember: true });
    const { user: targetUser } = await usersFactory.create();
    await login(page, teamMember, "/admin");
    await page.getByPlaceholder("Enter user email").fill(targetUser.email);
    await page.getByRole("button", { name: "Impersonate user" }).click();
    await page.waitForURL(/\/impersonate\?.*/u);
    await page.waitForURL(/\/invoices(\/.*)?$/u);
    await expect(page.getByRole("button", { name: "Stop impersonating" })).toBeVisible();
    await expect(page.getByText(targetUser.email)).toBeVisible();
    await page.route("**/internal/**", (route) => route.fulfill({ status: 401, body: "Unauthorized" }));
    await page.goto("/invoices"); // This triggers a request that fails with 401
    await page.waitForURL(/\/impersonate\?actor_token=null/u);
    await page.waitForURL(/\/invoices(\/.*)?$/u);
    await page.unroute("**/internal/**");
    await expect(page.getByRole("button", { name: "Stop impersonating" })).not.toBeVisible();
    await expect(page.getByText(teamMember.email)).toBeVisible();
  });

  test("cannot impersonate themselves, nonexistent users, or other team members", async ({ page }) => {
    const { user: teamMember } = await usersFactory.create({ teamMember: true });
    const { user: anotherTeamMember } = await usersFactory.create({ teamMember: true });
    await login(page, teamMember, "/admin");
    await page.getByPlaceholder("Enter user email").fill(teamMember.email);
    await page.getByRole("button", { name: "Impersonate user" }).click();
    await expect(page.getByText("Nice try, but you can't impersonate yourself!")).toBeVisible();
    await page.getByPlaceholder("Enter user email").fill("nonexistent@flexile.com");
    await page.getByRole("button", { name: "Impersonate user" }).click();
    await expect(page.getByText("User not found")).toBeVisible();
    await page.getByPlaceholder("Enter user email").fill(anotherTeamMember.email);
    await page.getByRole("button", { name: "Impersonate user" }).click();
    await expect(page.getByText("Something went wrong.")).toBeVisible();
  });
});
