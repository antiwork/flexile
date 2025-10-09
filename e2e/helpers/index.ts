import { expect, type Locator, type Page } from "@playwright/test";

export const selectComboboxOption = async (page: Page, name: string, option: string) => {
  const combobox = page.getByRole("combobox", { name, exact: true });
  await combobox.click();
  const popover = page.getByRole("listbox", { name: /listbox options/u });
  // Not ideal that we end up with a combobox nested inside another, but this issue exists in shadcn too so we can address it elsewhere.
  const searchField = popover.getByRole("combobox");

  await searchField.fill(option);
  await expect(popover.getByRole("option", { name: option, exact: true })).toBeVisible();

  await searchField.press("Enter");
  await expect(popover).not.toBeVisible();
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

export const fillByLabel = async (page: Page, name: string, value: string, options: FillByLabelOptions = {}) => {
  const { index, exact } = options;
  let field = page.getByLabel(name, { exact: Boolean(exact) });
  if (typeof index === "number") {
    field = field.nth(index);
  }
  await field.fill(value);
};
