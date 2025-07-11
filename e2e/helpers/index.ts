import type { Page } from "@playwright/test";

export const selectComboboxOption = async (page: Page, name: string, option: string, search = false) => {
  await page.getByRole("combobox", { name }).click();
  if (search) await page.getByPlaceholder("Search...").fill(option);
  await page.getByRole("option", { name: option, exact: true }).first().click();
  await page.getByRole("option", { name: option, exact: true }).first().waitFor({ state: "detached" });
};

export const fillDatePicker = async (page: Page, name: string, value: string) =>
  page.getByRole("spinbutton", { name }).first().pressSequentially(value, { delay: 50 });
