import { expect, type Locator, type Page } from "@playwright/test";

export const selectComboboxOption = async (page: Locator | Page, name: string, option: string) => {
  await page.getByRole("combobox", { name }).click();
  await page.getByRole("option", { name: option, exact: true }).first().click();
};

export const fillDatePicker = async (page: Page, name: string, value: string) => {
  const date = page.getByRole("spinbutton", { name }).first();
  // Wait for the field to be interactive before typing to avoid lost keystrokes
  await expect(date).toBeEditable();
  // Add delay between keystrokes as workaround for React Aria Components JS interop issues
  return date.pressSequentially(value, { delay: 100 });
};

export const findRichTextEditor = (page: Locator | Page, name: string) =>
  page.locator(
    `xpath=.//*[@contenteditable="true" and ((./@aria-label = ${JSON.stringify(name)}) or (./@id = //label[contains(., ${JSON.stringify(name)})]/@for))]`,
  );

export type FillByLabelOptions = {
  index?: number;
  exact?: boolean;
};

export const fillByLabelSafe = async (page: Page, name: string, value: string, options: FillByLabelOptions = {}) => {
  const { index, exact } = options;
  let field = page.getByLabel(name, { exact: Boolean(exact) });
  if (typeof index === "number") {
    field = field.nth(index);
  }

  await expect(field).toBeVisible();
  await expect(field).toBeEditable();

  await field.fill(value);

  await expect(field).toHaveValue(value);
};
