import { type Page } from "@playwright/test";
import type { users } from "@/db/schema";

export const loginWithGoogle = async (page: Page, user: typeof users.$inferSelect) => {
  await page.goto("/login");

  const cookieValue = JSON.stringify({
    email: user.email,
    googleUid: user.googleUid,
  });

  await page.context().addCookies([
    {
      name: "test_google_user",
      value: cookieValue,
      domain: new URL(page.url()).hostname,
      path: "/",
    },
  ]);

  await page.getByRole("button", { name: "Log in with Google" }).click();

  // Wait for successful redirect
  await page.waitForURL(/^(?!.*\/login$).*/u);
};

export const signupWithGoogle = async (
  page: Page,
  user: {
    email: string;
    googleUid: string;
  },
) => {
  await page.goto("/signup");

  const cookieValue = JSON.stringify(user);

  await page.context().addCookies([
    {
      name: "test_google_user",
      value: cookieValue,
      domain: new URL(page.url()).hostname,
      path: "/",
    },
  ]);

  await page.getByRole("button", { name: "Sign up with Google" }).click();

  await page.waitForURL(/^(?!.*\/(signup|login)$).*/u);
};
