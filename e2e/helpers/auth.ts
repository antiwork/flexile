import { expect, type Page } from "@playwright/test";
import { users } from "@/db/schema";

/** Backend accepts "000000" when Rails.env.test? && ENV['ENABLE_DEFAULT_OTP'] == 'true' */
const TEST_OTP_CODE = "000000";

export const fillOtp = async (page: Page) => {
  const otp = page.getByRole("textbox", { name: "Verification code" });
  await expect(otp).toBeVisible();
  await otp.fill(TEST_OTP_CODE);
};

export const login = async (page: Page, user: typeof users.$inferSelect, redirectTo?: string) => {
  const pageURL = redirectTo ? redirectTo : "/login";
  await page.goto(pageURL);

  await page.getByLabel("Work email").fill(user.email);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await fillOtp(page);

  // Wait for navigation away from login page (ensures login finished)
  await page.waitForURL(/^(?!.*\/login$).*/u);
};

export const logout = async (page: Page) => {
  if (page.url().includes("/login")) {
    return;
  }

  // Ensure we're on a dashboard page with sidebar
  if (!page.url().includes("/invoices")) {
    await page.goto("/invoices");
  }

  await page.getByRole("button", { name: "Log out" }).first().click();

  // Make waitForURL tolerant: wait longer and ensure we handle cases where redirect may be delayed.
  await page.waitForURL(/.*\/login.*/u, { timeout: 60_000 });
  await page.waitForLoadState("networkidle");
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function safeStringify(value: unknown, maxLen = 1000): string {
  if (typeof value === "string") return value;
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (isRecord(value) || Array.isArray(value)) {
    try {
      const json = JSON.stringify(value);
      return json.length > maxLen ? `${json.slice(0, maxLen)}...` : json;
    } catch {
      // fallback below
    }
  }
  try {
    return String(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
}

/**
 * Mock external OAuth provider callback so tests can override returned email.
 * Rewrites the POST body to include the provided credentials.email when possible.
 *
 * This handler:
 *  - parses incoming request body (JSON or urlencoded),
 *  - injects credentials.email,
 *  - sets an appropriate Content-Type header,
 *  - continues the request with modified body/headers.
 */
export const externalProviderMock = async (page: Page, provider: string, credentials: { email: string }) => {
  await page.route(`**/api/auth/callback/${provider}`, async (route) => {
    try {
      const req = route.request();
      const raw = req.postData() ?? "";

      // Try parse JSON first
      let parsed: unknown = null;
      if (typeof raw === "string" && raw.length > 0) {
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = null;
        }
      }

      const flattenToStrings = (obj: Record<string, unknown>) => {
        const out: Record<string, string> = {};
        for (const [k, v] of Object.entries(obj)) {
          out[k] = v == null ? "" : String(v);
        }
        return out;
      };

      // If parsed is an object (JSON), continue as JSON
      if (isRecord(parsed)) {
        const flat = flattenToStrings(parsed);
        flat.email = credentials.email;
        const modifiedJson = JSON.stringify(flat);
        const headers = { ...req.headers(), "content-type": "application/json" };
        // eslint-disable-next-line no-console
        // console.log("externalProviderMock (json) ->", modifiedJson, headers);
        await route.continue({ postData: modifiedJson, headers });
        return;
      }

      // If the raw string looks urlencoded (contains '='), treat as form data
      if (typeof raw === "string" && raw.includes("=")) {
        const params = new URLSearchParams(raw);
        params.set("email", credentials.email);
        const modifiedData = params.toString();
        const headers = { ...req.headers(), "content-type": "application/x-www-form-urlencoded" };
        // eslint-disable-next-line no-console
        // console.log("externalProviderMock (form) ->", modifiedData, headers);
        await route.continue({ postData: modifiedData, headers });
        return;
      }

      // Fallback: synthesize minimal form body
      const fallback = new URLSearchParams({ email: credentials.email }).toString();
      const headers = { ...req.headers(), "content-type": "application/x-www-form-urlencoded" };
      // eslint-disable-next-line no-console
      // console.log("externalProviderMock (fallback) ->", fallback, headers);
      await route.continue({ postData: fallback, headers });
    } catch (errUnknown) {
      // Log a useful string instead of "[object Object]".
      // eslint-disable-next-line no-console
      console.warn("externalProviderMock route handler error:", safeStringify(errUnknown));
      await route.continue();
    }
  });
};
