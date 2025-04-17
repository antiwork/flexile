import { type Page, expect } from "../index";

/**
 * Helper function to check if a Combobox component is visible
 * @param page Playwright page
 * @param label Label text to find the Combobox
 */
export async function checkComboboxVisible(page: Page, label: string) {
  const labelElement = page.getByText(label, { exact: true });
  
  await expect(labelElement).toBeVisible();
  
  const htmlFor = await labelElement.getAttribute("for");
  
  if (htmlFor) {
    await expect(page.locator(`button#${htmlFor}`)).toBeVisible();
  } else {
    await expect(page.locator(`label:has-text("${label}") + div button, label:has-text("${label}") ~ div button`)).toBeVisible();
  }
}
