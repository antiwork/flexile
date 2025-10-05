import { type Locator, type Page } from "@playwright/test";

const REGEX_SPECIAL_CHARACTERS = new Set(["\\", ".", "*", "+", "?", "^", "$", "{", "}", "(", ")", "|", "[", "]"]);
const escapeForRegex = (value: string) =>
  value
    .split("")
    .map((char) => (REGEX_SPECIAL_CHARACTERS.has(char) ? `\\${char}` : char))
    .join("");

export const findTableRow = (page: Page, columnValues: Record<string, string>): Locator => {
  const rows = page.locator("tbody tr:not([hidden])");

  let matchingRows = rows;

  for (const expectedValue of Object.values(columnValues)) {
    const trimmedValue = expectedValue.trim();
    if (!trimmedValue) {
      continue;
    }

    const valueMatcher = new RegExp(escapeForRegex(trimmedValue), "iu");
    matchingRows = matchingRows.filter({ hasText: valueMatcher });
  }

  return matchingRows.first();
};
