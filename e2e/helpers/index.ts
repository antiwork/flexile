import { expect, type Locator, type Page } from "@playwright/test";

export const selectComboboxOption = async (page: Page, name: string, option: string) => {
  await page.getByRole("combobox", { name }).click();
  await page.getByRole("option", { name: option, exact: true }).first().click();
};

export const fillDatePicker = async (page: Page, name: string, value: string) => {
  const date = page.getByRole("spinbutton", { name }).first();
  await expect(date).toBeEditable();
  return date.pressSequentially(value, { delay: 100 });
};

export const findRichTextEditor = (page: Locator | Page, name: string) =>
  page.locator(`xpath=.//*[@contenteditable="true" and (./@id = //label[contains(., ${JSON.stringify(name)})]/@for)]`);

export type FillByLabelOptions = {
  index?: number;
  exact?: boolean;
  blur?: boolean;
};

export const fillByLabelSafe = async (page: Page, name: string, value: string, options: FillByLabelOptions = {}) => {
  const { index, exact, blur = true } = options;
  let field = page.getByLabel(name, { exact: Boolean(exact) });
  if (typeof index === "number") {
    field = field.nth(index);
  }

  await expect(field).toBeVisible();
  await expect(field).toBeEditable();

  await field.fill(value);

  if (blur) {
    await field.blur();
  }
};
