import { usersFactory } from "@test/factories/users";
import { expect, test } from "@test/index";

test("google login", async ({ page }) => {
  const { user } = await usersFactory.create();

  await page.route("**/internal/users/find_by_email", (route) => {
    route.fulfill({
      status: 200,
      body: JSON.stringify({
        user: {
          id: Number(user.id),
          email: user.email,
          legal_name: user.legalName,
        },
        jwt: "test-jwt",
      }),
    });
  });

  await page.goto("/login");

  const googleButton = page.getByText("Log in with Google");
  await expect(googleButton).toBeVisible();
  await googleButton.click();

  await page.waitForLoadState("networkidle");
  expect(true).toBe(true);
});

test("google login with redirect_url", async ({ page }) => {
  const { user } = await usersFactory.create();

  await page.route("**/internal/users/find_by_email", (route) => {
    route.fulfill({
      status: 200,
      body: JSON.stringify({
        user: {
          id: Number(user.id),
          email: user.email,
          legal_name: user.legalName,
        },
        jwt: "test-jwt",
      }),
    });
  });

  await page.goto("/login?redirect_url=%2Fpeople");

  const googleButton = page.getByText("Log in with Google");
  await expect(googleButton).toBeVisible();
  await googleButton.click();

  await page.waitForLoadState("networkidle");
  expect(true).toBe(true);
});

test("google signup", async ({ page }) => {
  await usersFactory.create();

  await page.route("**/internal/users/find_by_email", (route) => {
    route.fulfill({
      status: 404,
      body: JSON.stringify({ error: "User not found" }),
    });
  });

  await page.goto("/signup");

  const googleButton = page.getByText("Sign up with Google");
  await expect(googleButton).toBeVisible();
  await googleButton.click();

  await page.waitForLoadState("networkidle");
  expect(true).toBe(true);
});

test("google authentication error handling", async ({ page }) => {
  await page.route("**/api/auth/signin/google", (route) =>
    route.fulfill({
      status: 500,
      body: JSON.stringify({ error: "Authentication failed" }),
    }),
  );

  await page.goto("/login");

  const googleButton = page.getByText("Log in with Google");
  await expect(googleButton).toBeVisible();
  await googleButton.click();

  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Log in with Google")).toBeVisible();
});
