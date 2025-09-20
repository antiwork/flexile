import type { Locator, Page } from "@playwright/test";
import { format, isAfter, isSameMonth, parse } from "date-fns";

export const selectComboboxOption = async (page: Locator | Page, name: string, option: string) => {
  await page.getByRole("combobox", { name }).click();
  await page.getByRole("option", { name: option, exact: true }).first().click();
};

export const fillDatePicker = async (page: Locator | Page, name: string, value: string) => {
  // Default date picker
  const spinButton = page.getByRole("spinbutton", { name: "Date" }).first();

  if (await spinButton.count()) {
    await spinButton.pressSequentially(value, { delay: 50 });
    return;
  }

  // Button date picker
  await page.getByRole("button", { name }).click();
  const target = parse(value, "MM/dd/yyyy", new Date());

  const popover = page.locator('[role="dialog"][data-rac]');
  const heading = popover.getByRole("heading");
  const prev = page.locator('button[slot="previous"]');
  const next = page.locator('button[slot="next"]');

  while (true) {
    const current = parse((await heading.textContent()) ?? "", "MMMM yyyy", new Date());

    if (isSameMonth(current, target)) break;
    else if (isAfter(current, target)) await prev.click();
    else await next.click();
  }

  await page.getByRole("button", { name: format(target, "EEEE, MMMM d, yyyy") }).click();
};

export const findRichTextEditor = (page: Locator | Page, name: string) =>
  page.locator(`xpath=.//*[@contenteditable="true" and (./@id = //label[contains(., ${JSON.stringify(name)})]/@for)]`);
