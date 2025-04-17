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
    await labelElement.click();
  }

  await page.getByRole("textbox").fill(value);

  await page.getByRole("option").filter({ hasText: value }).click();
}
