import type { Page } from "@playwright/test";

export const navigateToTenderOffers = async (page: Page) => {
  await page.getByRole("button", { name: "Equity" }).click();
  await page.getByRole("link", { name: "Buybacks" }).click();
  await page.waitForURL(/\/equity\/tender_offers/u);
};

export const openTenderOfferDetails = async (page: Page, tenderOfferId: string) => {
  await page.locator(`a[href="/equity/tender_offers/${tenderOfferId}"]`).click();
  await page.waitForURL(/\/equity\/tender_offers\/[a-zA-Z0-9]+/u);
};
