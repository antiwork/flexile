import { type Page } from "../index";

/**
 * Helper function to interact with a Combobox component
 * @param page Playwright page
 * @param label Label text to find the Combobox
 * @param value Value to select from the Combobox
 */
export async function fillCombobox(page: Page, label: string, value: string) {
  const labelElement = page.getByText(label, { exact: true });

  const htmlFor = await labelElement.getAttribute("for");

  if (htmlFor) {
    await page.locator(`button#${htmlFor}`).click();
  } else {
    await page
      .locator(`label:has-text("${label}") + div button, label:has-text("${label}") ~ div button`)
      .first()
      .click();
  }

  await page.waitForSelector('[role="dialog"], [cmdk-input]');

  const input = page.locator('[cmdk-input], [role="searchbox"], [role="combobox"]').first();
  await input.fill(value);

  await page.locator('[cmdk-item], [role="option"]').filter({ hasText: value }).first().click();
}
