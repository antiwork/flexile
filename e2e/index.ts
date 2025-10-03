import { expect as baseExpected, type Locator, type Page } from "@playwright/test";
import { createTableRowEngine, serializeColumnValues } from "@test/selectors/tableRowEngine";
import { test as baseTest } from "next/experimental/testmode/playwright.js";
import type { CreateEmailOptions } from "resend";
import { parseHTML } from "zeed-dom";
import { assertDefined } from "@/utils/assert";

export * from "@playwright/test";

type ExtendedPage = Page & {
  getByTableRowCustom: (columnValues: Record<string, string | RegExp>) => Locator;
};

type SentEmail = Omit<CreateEmailOptions, "html" | "text" | "react"> & { html: string; text: string };
export const test = baseTest.extend<
  {
    page: ExtendedPage;
    sentEmails: SentEmail[];
  },
  {
    // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
    selectorRegistration: void;
  }
>({
  selectorRegistration: [
    async ({ playwright }, use) => {
      await playwright.selectors.register("tableRow", createTableRowEngine);
      console.log("[DEBUG] tableRow selector engine registered successfully");
      await use();
    },
    { scope: "worker", auto: true },
  ],
  page: async ({ page }, use) => {
    const extendedPage: ExtendedPage = Object.assign(page, {
      getByTableRowCustom: (columnValues: Record<string, string | RegExp>) =>
        page.locator(`tableRow=${serializeColumnValues(columnValues)}`),
    });
    await use(extendedPage);
  },
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

export const expect = baseExpected.extend({
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
  { page, title, assertClosed = true }: { page: Page; title?: string | RegExp; assertClosed?: boolean },
) => {
  const modal = title ? page.getByRole("dialog", { name: title }) : page.getByRole("dialog");
  await expect(modal).toBeVisible();
  await callback(modal);
  if (assertClosed) await expect(modal).not.toBeVisible();
};
