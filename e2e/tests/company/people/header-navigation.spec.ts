import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { companyLawyersFactory } from "@test/factories/companyLawyers";
import { convertibleSecuritiesFactory } from "@test/factories/convertibleSecurities";
import { dividendsFactory } from "@test/factories/dividends";
import { documentsFactory } from "@test/factories/documents";
import { equityGrantExercisesFactory } from "@test/factories/equityGrantExercises";
import { equityGrantsFactory } from "@test/factories/equityGrants";
import { shareClassesFactory } from "@test/factories/shareClasses";
import { shareHoldingsFactory } from "@test/factories/shareHoldings";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, type Page, test } from "@test/index";
import { addDays, subDays } from "date-fns";

test.describe("People header navigation", () => {
  const expectedTabs = [
    { name: "Shares", href: "shares" },
    { name: "Exercises", href: "exercises" },
    { name: "Dividends", href: "dividends" },
    { name: "Convertibles", href: "convertibles" },
    { name: "Options", href: "options" },
  ];

  const setup = async () => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding({
      equityEnabled: true,
    });

    await companyContractorsFactory.create({
      companyId: company.id,
      userId: adminUser.id,
    });

    const { companyInvestor } = await companyInvestorsFactory.create({
      companyId: company.id,
      userId: adminUser.id,
    });

    await documentsFactory.create({ companyId: company.id });
    const shareClass = (await shareClassesFactory.create({ companyId: company.id })).shareClass;
    await shareHoldingsFactory.create({ companyInvestorId: companyInvestor.id, shareClassId: shareClass.id });
    await equityGrantExercisesFactory.create({ companyInvestorId: companyInvestor.id });
    await equityGrantsFactory.create({ companyInvestorId: companyInvestor.id });
    await dividendsFactory.create({ companyId: company.id, companyInvestorId: companyInvestor.id });
    await convertibleSecuritiesFactory.create({ companyInvestorId: companyInvestor.id });
    return { company, adminUser, companyInvestor };
  };

  const expectTab = async (page: Page, name: string, href: string) => {
    await expect(page.getByRole("tab", { name })).toBeVisible();
    await expect(page.getByRole("tab", { name })).toHaveAttribute("href", `?tab=${href}`);
  };

  test("shows the expected tabs for lawyer", async ({ page }) => {
    const { company, adminUser } = await setup();
    const companyLawyer = (await usersFactory.create()).user;
    await companyLawyersFactory.create({ companyId: company.id, userId: companyLawyer.id });
    await login(page, companyLawyer, `/people/${adminUser.externalId}`);

    await expect(page.getByRole("tab", { name: "Details" })).not.toBeVisible();
    for (const { name, href } of expectedTabs) await expectTab(page, name, href);
  });

  test("shows the expected tabs for company administrator", async ({ page }) => {
    const { adminUser } = await setup();
    await login(page, adminUser, `/people/${adminUser.externalId}`);

    for (const { name, href } of expectedTabs) await expectTab(page, name, href);
    await expectTab(page, "Details", "details");
  });
});

test.describe("People Status column sorting", () => {
  test("sorts contractors by date in ascending and descending order", async ({ page }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding();

    // Create contractors with different dates for predictable sorting
    const baseDate = new Date();
    const contractorData = [
      {
        name: "Contractor A",
        startedAt: subDays(baseDate, 100),
        endedAt: subDays(baseDate, 50), // Ended 50 days ago
      },
      {
        name: "Contractor B",
        startedAt: subDays(baseDate, 200),
        endedAt: subDays(baseDate, 10), // Ended 10 days ago
      },
      {
        name: "Contractor C",
        startedAt: subDays(baseDate, 60), // Started 60 days ago
      },
      {
        name: "Contractor D",
        startedAt: subDays(baseDate, 20), // Started 20 days ago
      },
      {
        name: "Contractor E",
        startedAt: addDays(baseDate, 5), // Starts in 5 days
      },
    ];

    // Create contractors with the test data
    for (const contractor of contractorData) {
      const user = (await usersFactory.create()).user;
      await companyContractorsFactory.create({
        companyId: company.id,
        userId: user.id,
        startedAt: contractor.startedAt,
        endedAt: contractor.endedAt,
      });
    }

    await login(page, adminUser, "/people");

    // Wait for the table to load and first row to be visible
    await expect(page.locator("tbody tr").first()).toBeVisible();

    // Wait for the first row to have actual content (not empty cells)
    await page.waitForFunction(() => {
      const firstRow = document.querySelector("tbody tr:first-child");
      if (!firstRow) return false;
      const cells = firstRow.querySelectorAll("td");
      return cells.length > 0 && Array.from(cells).some((cell) => cell.textContent?.trim() !== "");
    });

    // await page.waitForTimeout(1000); // Additional buffer

    // Get all status cells to verify sorting
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
    const initialDates = extractDatesFromStatus(initialStatusCells);

    let isSortedAscending = true;
    for (let i = 0; i < initialDates.length - 1; i++) {
      const currentDate = initialDates[i];
      const nextDate = initialDates[i + 1];
      if (currentDate && nextDate && currentDate.getTime() > nextDate.getTime()) {
        isSortedAscending = false;
        break;
      }
    }
    expect(isSortedAscending).toBe(true);

    await page.getByRole("columnheader", { name: "Status" }).click();
    await page.waitForTimeout(1000);

    const statusCellsAfterFirstClick = await getStatusCells().allTextContents();
    expect(statusCellsAfterFirstClick).not.toEqual(initialStatusCells);

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

    expect(statusCellsAfterSecondClick).toHaveLength(contractorData.length);
  });
});
