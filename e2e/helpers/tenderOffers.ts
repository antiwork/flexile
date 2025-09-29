import type { Page } from "@playwright/test";

export const navigateToTenderOffers = async (page: Page) => {
  await page.getByRole("button", { name: "Equity" }).click();
  await page.getByRole("link", { name: "Buybacks" }).click();
  // eslint-disable-next-line require-unicode-regexp
  await page.waitForURL(/\/equity\/tender_offers/);
};

export const openTenderOfferDetails = async (page: Page, tenderOfferId: string) => {
  await page.locator(`a[href="/equity/tender_offers/${tenderOfferId}"]`).click();
  // eslint-disable-next-line require-unicode-regexp
  await page.waitForURL(/\/equity\/tender_offers\/[a-zA-Z0-9]+/);
};
