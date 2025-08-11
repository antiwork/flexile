import { type Page } from "@playwright/test";
import type { users } from "@/db/schema";

export const loginWithGitHub = async (page: Page, user: typeof users.$inferSelect) => {
  await page.goto("/login");

  const cookieValue = JSON.stringify({
    email: user.email,
    githubUid: user.githubUid,
  });

  await page.context().addCookies([
    {
      name: "test_github_user",
      value: cookieValue,
      domain: new URL(page.url()).hostname,
      path: "/",
    },
  ]);

  await page.getByRole("button", { name: "Log in with GitHub" }).click();

  // Wait for successful redirect
  await page.waitForURL(/^(?!.*\/login$).*/u);
};

export const signupWithGitHub = async (
  page: Page,
  user: {
    email: string;
    githubUid: string;
  },
) => {
  await page.goto("/signup");

  const cookieValue = JSON.stringify(user);

  await page.context().addCookies([
    {
      name: "test_github_user",
      value: cookieValue,
      domain: new URL(page.url()).hostname,
      path: "/",
    },
  ]);

  await page.getByRole("button", { name: "Sign up with GitHub" }).click();

  await page.waitForURL(/^(?!.*\/(signup|login)$).*/u);
};
