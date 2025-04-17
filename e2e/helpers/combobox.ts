import { type Page } from "../index";

/**
 * Helper function to interact with a Combobox component
 * @param page Playwright page
 * @param label Label text to find the Combobox
 * @param value Value to select from the Combobox
 */
export async function fillCombobox(page: Page, label: string, value: string) {
  await page.getByLabel(label).click();
  
  await page.getByRole("combobox").fill(value);
  
  await page.getByRole("option").filter({ hasText: value }).click();
}
