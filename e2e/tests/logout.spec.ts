import type { Page } from "@playwright/test";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";

const isNextAuthSession = (name: string) => /^(__Secure-)?next-auth\.session-token$/u.test(name);

const countNextAuthSessionCookies = async (page: Page) => {
  const cookies = await page.context().cookies();
  return cookies.filter((c) => isNextAuthSession(c.name)).length;
};

test.describe("Logout", () => {
  test("clears auth cookies and redirects to /login", async ({ page }) => {
    const { user } = await usersFactory.create();
    await login(page, user);

    await expect.poll(() => countNextAuthSessionCookies(page)).toBe(1);

    await page.getByRole("button", { name: "Log out" }).click();

    await page.waitForURL(/\/login(\?|$)/u);

    await expect.poll(() => countNextAuthSessionCookies(page)).toBe(0);
  });
});
