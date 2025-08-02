import { expect as baseExpect, type Locator, type Page } from "@playwright/test";
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
});

export const withinModal = async (
  callback: (modal: Locator) => Promise<void>,
  { page, title }: { page: Page; title?: string },
) => {
  const modal = title ? page.getByRole("dialog", { name: title }) : page.getByRole("dialog");
  await modal.waitFor({ state: "visible" });
  await callback(modal);
};
