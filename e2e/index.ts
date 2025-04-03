import { type Browser, expect as baseExpect, type Locator, type Page } from "@playwright/test";
import { test as baseTest } from "next/experimental/testmode/playwright.js";
import type { CreateEmailOptions } from "resend";
import { parseHTML } from "zeed-dom";
import { assertDefined } from "@/utils/assert";

export * from "@playwright/test";

type SentEmail = Omit<CreateEmailOptions, "html" | "text" | "react"> & { html: string; text: string };
export const test = baseTest.extend<{
  sentEmails: SentEmail[];
}>({
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
