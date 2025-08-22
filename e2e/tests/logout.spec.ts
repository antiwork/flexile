import { db } from "@test/db";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { eq } from "drizzle-orm";
import { users } from "@/db/schema";

test.describe("Logout", () => {
  test("redirects to login page and blocks gated routes", async ({ page }) => {
    const { user } = await usersFactory.create();
    const userBeforeLogin = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });

    await login(page, user);

    const userAfterLogin = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });

    // Confirm login
    expect(userBeforeLogin?.currentSignInAt).toBeNull();
    expect(userAfterLogin?.currentSignInAt).not.toBeNull();
    expect(userAfterLogin?.currentSignInAt).not.toBe(userBeforeLogin?.currentSignInAt);

    await page.getByRole("button", { name: "Log out" }).click();

    await page.waitForURL(/\/login(\?|$)/u);
    await page.goto("/invoices");
    await page.waitForURL(/\/login(\?|$)/u);

    await expect(page.getByText("Welcome back")).toBeVisible();
  });
});
