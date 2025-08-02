import type { Page } from "@playwright/test";

export const selectComboboxOption = async (page: Page, name: string, option: string) => {
  // Wait for the combobox to be available and visible
  const combobox = page.getByRole("combobox", { name });
  await combobox.waitFor({ state: "visible", timeout: 10000 });
  await combobox.click();

  // Wait for the options to appear and select the specific option
  const optionElement = page.getByRole("option", { name: option, exact: true }).first();
  await optionElement.waitFor({ state: "visible", timeout: 10000 });
  await optionElement.click();

  // Wait a moment for the selection to register
  await page.waitForTimeout(100);
};

export const fillDatePicker = async (page: Page, name: string, value: string) =>
  page.getByRole("spinbutton", { name }).first().pressSequentially(value, { delay: 50 });
