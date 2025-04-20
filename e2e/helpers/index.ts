import type { Page } from "@playwright/test";

export const selectComboboxOption = async (page: Page, name: string, option: string) => {
  await page.getByLabel(name).click();
  await page.getByRole("option", { name: option }).click();
};
