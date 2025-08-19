import type { Locator, Page } from "@playwright/test";

export const selectComboboxOption = async (page: Page, name: string, option: string) => {
  await page.getByRole("combobox", { name }).click();
  await page.getByRole("option", { name: option, exact: true }).first().click();
};

export const fillDatePicker = async (page: Page, name: string, value: string) =>
  page.getByRole("spinbutton", { name }).first().pressSequentially(value, { delay: 50 });

export const findRichTextEditor = (page: Locator | Page, name: string) =>
  page.locator(`xpath=.//*[@contenteditable="true" and (./@id = //label[contains(., ${JSON.stringify(name)})]/@for)]`);
