import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { addDays, subDays } from "date-fns";

test.describe("Status Column Sorting in People Page", () => {
  test("sorts contractors by date in ascending and descending order", async ({ page }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding();

    const dateNow = new Date();
    await companyContractorsFactory.create({
      companyId: company.id,
      role: "Contractor Upcoming",
      startedAt: addDays(dateNow, 100),
    });
    await companyContractorsFactory.create({
      companyId: company.id,
      role: "Contractor ended",
      startedAt: subDays(dateNow, 10),
      endedAt: subDays(dateNow, 1),
    });
    await companyContractorsFactory.create({
      companyId: company.id,
      role: "Contractor active",
      startedAt: subDays(dateNow, 2),
    });
    await companyContractorsFactory.create({
      companyId: company.id,
      role: "contractor active  2",
      startedAt: subDays(dateNow, 3),
    });

    await login(page, adminUser, "/people");

    await expect(page.locator("tbody tr").first()).toBeVisible();
    await page.waitForFunction(() => {
      const firstRow = document.querySelector("tbody tr:first-child");
      if (!firstRow) return false;
      const cells = firstRow.querySelectorAll("td");
      return cells.length > 0 && Array.from(cells).some((cell) => cell.textContent?.trim() !== "");
    });

    const getStatusCells = () => page.locator("tbody tr td:last-child");

    const extractDatesFromStatus = (statusTexts: string[]) =>
      statusTexts.map((text) => {
        const dateMatch = /(?:Started on|Ended on|Starts on)\s+(.+)$/u.exec(text);
        if (dateMatch?.[1]) {
          return new Date(dateMatch[1]);
        }
        return new Date(0);
      });

    const initialStatusCells = await getStatusCells().allTextContents();

    await page.getByRole("columnheader", { name: "Status" }).click();
    await page.waitForTimeout(1000);

    const statusCellsAfterFirstClick = await getStatusCells().allTextContents();
    expect(statusCellsAfterFirstClick).not.toEqual(initialStatusCells);

    const datesAfterFirstClick = extractDatesFromStatus(statusCellsAfterFirstClick);
    let isSortedAscending = true;
    for (let i = 0; i < datesAfterFirstClick.length - 1; i++) {
      const currentDate = datesAfterFirstClick[i];
      const nextDate = datesAfterFirstClick[i + 1];
      if (currentDate && nextDate && currentDate.getTime() > nextDate.getTime()) {
        isSortedAscending = false;
        break;
      }
    }
    expect(isSortedAscending).toBe(true);

    await page.getByRole("columnheader", { name: "Status" }).click();
    await page.waitForTimeout(1000);

    const statusCellsAfterSecondClick = await getStatusCells().allTextContents();
    expect(statusCellsAfterSecondClick).not.toEqual(statusCellsAfterFirstClick);

    const datesAfterSecondClick = extractDatesFromStatus(statusCellsAfterSecondClick);
    let isSortedDescending = true;
    for (let i = 0; i < datesAfterSecondClick.length - 1; i++) {
      const currentDate = datesAfterSecondClick[i];
      const nextDate = datesAfterSecondClick[i + 1];
      if (currentDate && nextDate && currentDate.getTime() < nextDate.getTime()) {
        isSortedDescending = false;
        break;
      }
    }
    expect(isSortedDescending).toBe(true);

    expect(statusCellsAfterSecondClick).toHaveLength(4);
  });
});
