import { expect as baseExpect, type Locator, type Page } from "@playwright/test";
import { clearClerkUser } from "@test/helpers/auth";
import { test as baseTest } from "next/experimental/testmode/playwright.js";
import type { CreateEmailOptions } from "resend";
import { parseHTML } from "zeed-dom";
import { assertDefined } from "@/utils/assert";

export * from "@playwright/test";

type SentEmail = Omit<CreateEmailOptions, "html" | "text" | "react"> & { html: string; text: string };
export const test = baseTest.extend<{
  sentEmails: SentEmail[];
  setup: undefined;
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
  setup: [
    async ({}, use) => {
      await use(undefined);
      await clearClerkUser();
    },
    { auto: true },
  ],
});

export const expect = baseExpect.extend({
  async toBeValid(locator: Locator) {
    let error: unknown;
    try {
      await expect(async () =>
        expect(
          (await locator.evaluate((el: HTMLInputElement) => el.validity.valid)) &&
            (await locator.getAttribute("aria-invalid")) !== "true",
        ).toBe(!this.isNot),
      ).toPass();
    } catch (e) {
      error = e;
    }

    return {
      pass: !error !== this.isNot,
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      message: () => `expected element to be ${this.isNot ? "invalid" : "valid"}: ${error}`,
    };
  },

  async toHaveTooltip(locator: Locator, expectedText: string, { exact = false }: { exact?: boolean } = {}) {
    // `force: true` allows hovering over disabled elements.
    await locator.hover({ force: true });

    let pass = true;
    try {
      await expect(locator.page().getByRole("tooltip", { name: expectedText, exact })).toBeVisible({
        visible: !this.isNot,
      });
    } catch {
      pass = !pass;
    }

    return {
      message: () => `expected element to ${this.isNot ? "not " : ""}have tooltip with text "${expectedText}"`,
      pass,
    };
  },
});

export const withinModal = async (
  callback: (modal: Locator) => Promise<void>,
  { page, title }: { page: Page; title?: string },
) => {
  const modal = title ? page.getByRole("dialog", { name: title }) : page.getByRole("dialog");
  await modal.waitFor({ state: "visible" });
  await callback(modal);
};
