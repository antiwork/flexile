import { type Browser, expect as baseExpect, type Locator, type Page } from "@playwright/test";
import { db } from "@test/db";
import { sql } from "drizzle-orm";
import { test as baseTest } from "next/experimental/testmode/playwright.js";
import type { CreateEmailOptions } from "resend";
import { parseHTML } from "zeed-dom";
import { assertDefined } from "@/utils/assert";

export * from "@playwright/test";

type SentEmail = Omit<CreateEmailOptions, "html" | "text" | "react"> & { html: string; text: string };
export const test = baseTest.extend<{
  truncateTablesBeforeEachTest: undefined;
  sentEmails: SentEmail[];
}>({
  // TODO (techdebt): Truncating all of the tables will be problematic when we
  // start running tests in parallel. We should come up with an alternative
  // like wrapping each test run in a transaction.
  truncateTablesBeforeEachTest: [
    async ({}, use) => {
      const result = await db.execute<{ tablename: string }>(
        sql`SELECT tablename FROM pg_tables WHERE schemaname='public'`,
      );

      const tables = result.rows
        .map(({ tablename }) => tablename)
        .filter((name) => !["_drizzle_migrations", "wise_credentials", "document_templates"].includes(name))
        .map((name) => `"public"."${name}"`);

      await db.execute(sql`TRUNCATE TABLE ${sql.raw(tables.join(","))} CASCADE;`);
      await db.execute(sql`DELETE FROM document_templates WHERE company_id IS NOT NULL;`);

      await use(undefined);
    },
    { auto: true },
  ],
  sentEmails: async ({ next }, use) => {
    const emails: SentEmail[] = [];
    next.onFetch(async (request) => {
      if (request.method === "POST" && request.url === "https://api.resend.com/emails") {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- not worth validating
        const email = (await request.json()) as SentEmail;
        if (!email.text) email.text = assertDefined(parseHTML(email.html).textContent);
        emails.push(email);
        return new Response("{}");
      }
    });
    await use(emails);
  },
});

export const expect = baseExpect.extend({
  async toBeValid(locator: Locator) {
    const actual = await locator.evaluate((el: HTMLInputElement) => el.validity.valid);

    return {
      message: () => `expected element to be ${this.isNot ? "invalid" : "valid"}`,
      pass: actual,
    };
  },

  async toHaveTooltip(locator: Locator, expectedText: string, { exact = false }: { exact?: boolean } = {}) {
    // `force: true` allows hovering over disabled elements.
    await locator.hover({ force: true });

    const tooltipElement = locator.page().getByRole("tooltip", { name: expectedText, exact });
    const pass = await tooltipElement.isVisible();

    return {
      message: () => `expected element to ${this.isNot ? "not " : ""}have tooltip with text "${expectedText}"`,
      pass,
    };
  },
});

export const withIsolatedBrowserSessionPage = async (
  callback: (page: Page) => Promise<void>,
  { browser }: { browser: Browser },
) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await callback(page);
  } finally {
    await context.close();
  }
};

export const withinModal = async (
  callback: (modal: Locator) => Promise<void>,
  { page, title }: { page: Page; title?: string },
) => {
  const modal = title ? page.getByRole("dialog", { name: title }) : page.getByRole("dialog");
  await modal.waitFor({ state: "visible" });
  await callback(modal);
};
