import { expect, type Page } from "@playwright/test";
import { users } from "@/db/schema";

// Backend accepts "000000" when Rails.env.test? && ENV['ENABLE_DEFAULT_OTP'] == 'true'
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

  // Wait for redirect to login and for network to be idle (logout finished)
  // Make waitForURL tolerant: wait longer and ensure we handle cases where redirect may be delayed.
  await page.waitForURL(/.*\/login.*/u, { timeout: 60_000 });
  await page.waitForLoadState("networkidle");
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function safeStringify(value: unknown, maxLen = 1000): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === undefined) return "undefined";
  if (value === null) return "null";

  if (isRecord(value) || Array.isArray(value)) {
    try {
      const json = JSON.stringify(value);
      return json.length > maxLen ? `${json.slice(0, maxLen)}...` : json;
    } catch {
      return Object.prototype.toString.call(value);
    }
  }

  return Object.prototype.toString.call(value);
}

/**
 * Mock external OAuth provider callback so tests can override returned email.
 * Robust behavior:
 *  - Handles incoming JSON or urlencoded bodies.
 *  - Rewrites email field to credentials.email.
 *  - Preserves original headers, and sets Content-Type that matches the rewritten body.
 */
export const externalProviderMock = async (page: Page, provider: string, credentials: { email: string }) => {
  await page.route(`**/api/auth/callback/${provider}`, async (route) => {
    try {
      const req = route.request();
      const raw = req.postData() ?? "";
      const originalHeaders = req.headers();

      // Try parse JSON safely
      const tryParseJson = (s: string): unknown => {
        try {
          return JSON.parse(s);
        } catch {
          return null;
        }
      };

      // Parse urlencoded into object
      const parseUrlEncoded = (s: string): Record<string, string> => {
        const params = new URLSearchParams(s);
        const out: Record<string, string> = {};
        for (const [k, v] of params.entries()) {
          out[k] = v;
        }
        return out;
      };

      let modifiedData: string | null = null;
      let newContentType: string | null = null;

      // Case A: incoming JSON body -> convert to urlencoded (server commonly expects form data)
      const parsedJson = typeof raw === "string" && raw.length > 0 ? tryParseJson(raw) : null;
      if (parsedJson && isRecord(parsedJson)) {
        const flat: Record<string, string> = {};
        for (const [k, v] of Object.entries(parsedJson)) {
          flat[k] = v == null ? "" : safeStringify(v);
        }
        flat.email = credentials.email;
        modifiedData = new URLSearchParams(flat).toString();
        newContentType = "application/x-www-form-urlencoded";
      } else if (typeof raw === "string" && raw.length > 0) {
        // Case B: incoming urlencoded form data -> overwrite email and keep urlencoded
        try {
          const flat = parseUrlEncoded(raw);
          flat.email = credentials.email;
          modifiedData = new URLSearchParams(flat).toString();
          newContentType = "application/x-www-form-urlencoded";
        } catch {
          // leave modifiedData null to fallback to continue()
          modifiedData = null;
        }
      }

      if (modifiedData != null && newContentType != null) {
        // Debugging log - will appear in runner logs and trace console (safe info).
        // eslint-disable-next-line no-console
        console.debug(`[externalProviderMock] intercept ${route.request().url()} -> sending ${newContentType}`);

        await route.continue({
          postData: modifiedData,
          headers: {
            ...originalHeaders,
            "content-type": newContentType,
          },
        });
        return;
      }

      // Fallback: continue original request
      await route.continue();
    } catch (errUnknown) {
      // Log safe string
      // eslint-disable-next-line no-console
      console.warn("externalProviderMock route handler error:", safeStringify(errUnknown));
      await route.continue();
    }
  });
};
