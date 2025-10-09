import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { addDays, subDays } from "date-fns";

test.describe("People Status Column Sorting", () => {
  test("sorts contractors by date in ascending and descending order on desktop", async ({ page }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding();

    const baseDate = new Date();
    const contractorData = [
      {
        name: "Contractor 1",
        startedAt: subDays(baseDate, 100),
        endedAt: subDays(baseDate, 50),
        role: "Software Engineer",
      },
      {
        name: "Contractor 2",
        startedAt: subDays(baseDate, 80),
        endedAt: subDays(baseDate, 60),
        role: "Data Analyst",
      },
      {
        name: "Contractor 3",
        startedAt: subDays(baseDate, 60),
        endedAt: subDays(baseDate, 20),
        role: "Project Manager",
      },
      {
        name: "Contractor 4",
        startedAt: subDays(baseDate, 30),
        role: "Product Manager",
      },
      {
        name: "Contractor 5",
        startedAt: subDays(baseDate, 200),
        role: "Designer",
      },
      {
        name: "Contractor 6",
        startedAt: addDays(baseDate, 30),
        role: "UI/UX Designer",
      },
      {
        name: "Contractor 7",
        startedAt: addDays(baseDate, 50),
        endedAt: addDays(baseDate, 10),
        role: "Marketing Manager",
      },
    ];

    for (const contractor of contractorData) {
      const { user } = await usersFactory.create({
        legalName: contractor.name,
        preferredName: contractor.name.split(" ")[0],
        countryCode: "US",
      });
      if (contractor.endedAt) {
        await companyContractorsFactory.createInactive({
          companyId: company.id,
          userId: user.id,
          startedAt: contractor.startedAt,
          endedAt: contractor.endedAt,
          role: contractor.role,
        });
      } else {
        await companyContractorsFactory.create({
          companyId: company.id,
          userId: user.id,
          startedAt: contractor.startedAt,
          role: contractor.role,
        });
      }
    }

    await login(page, adminUser, "/people");

    await expect(page.locator("tbody tr").first()).toBeVisible();
    await page.waitForFunction(() => {
      const firstRow = document.querySelector("tbody tr:first-child");
      if (!firstRow) return false;
      const cells = firstRow.querySelectorAll("td");
      return cells.length > 0 && Array.from(cells).some((cell) => cell.textContent?.trim() !== "");
    });

    const getStatusColumn = () => page.getByRole("columnheader", { name: "Status" });
    const getRows = () => page.locator("tbody tr");

    const extractDates = async () => {
      const rows = await getRows().all();
      const dates = [];
      for (const row of rows) {
        const statusCell = row.locator("td").last();
        const text = await statusCell.textContent();
        const dateMatch = /(?:Started on|Ended on|Starts on)\s+(.+)$/u.exec(text || "");
        if (dateMatch?.[1]) {
          dates.push(new Date(dateMatch[1]));
        } else {
          dates.push(null);
        }
      }
      return dates;
    };

    const isSortedAscending = (dates: (Date | null)[]) => {
      for (let i = 0; i < dates.length - 1; i++) {
        const current = dates[i];
        const next = dates[i + 1];
        if (current && next && current.getTime() > next.getTime()) {
          return false;
        }
      }
      return true;
    };

    const isSortedDescending = (dates: (Date | null)[]) => {
      for (let i = 0; i < dates.length - 1; i++) {
        const current = dates[i];
        const next = dates[i + 1];
        if (current && next && current.getTime() < next.getTime()) {
          return false;
        }
      }
      return true;
    };

    await getStatusColumn().click();
    await page.waitForTimeout(500);

    const ascendingDates = await extractDates();
    expect(isSortedAscending(ascendingDates)).toBe(true);

    await getStatusColumn().click();
    await page.waitForTimeout(500);

    const descendingDates = await extractDates();
    expect(isSortedDescending(descendingDates)).toBe(true);
    expect(descendingDates).not.toEqual(ascendingDates);

    const rowCount = await getRows().count();
    expect(rowCount).toBe(contractorData.length);
  });

  test("sorts contractors by date on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const { company, adminUser } = await companiesFactory.createCompletedOnboarding();

    const baseDate = new Date();
    const contractorData = [
      {
        name: "Contractor 1",
        startedAt: subDays(baseDate, 100),
        endedAt: subDays(baseDate, 10),
        role: "Software Engineer",
      },
      {
        name: "Contractor 2",
        startedAt: subDays(baseDate, 30),
        role: "Data Analyst",
      },
      {
        name: "Contractor 3",
        startedAt: addDays(baseDate, 50),
        endedAt: addDays(baseDate, 10),
        role: "Project Manager",
      },
      {
        name: "Contractor 4",
        startedAt: addDays(baseDate, 30),
        role: "Product Manager",
      },
    ];

    for (const contractor of contractorData) {
      const { user } = await usersFactory.create({
        legalName: contractor.name,
        preferredName: contractor.name.split(" ")[0],
        countryCode: "US",
      });
      if (contractor.endedAt) {
        await companyContractorsFactory.createInactive({
          companyId: company.id,
          userId: user.id,
          startedAt: contractor.startedAt,
          endedAt: contractor.endedAt,
          role: contractor.role,
        });
      } else {
        await companyContractorsFactory.create({
          companyId: company.id,
          userId: user.id,
          startedAt: contractor.startedAt,
          role: contractor.role,
        });
      }
    }

    await login(page, adminUser, "/people");

    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByText("Alumni Mobile")).toBeVisible();
    await expect(page.getByText("Active Mobile")).toBeVisible();
    await expect(page.getByText("Future Mobile")).toBeVisible();

    const rows = page.locator("tbody tr");
    await expect(rows).toHaveCount(3);

    await expect(rows.nth(0)).toContainText("Alumni Mobile");
    await expect(rows.nth(1)).toContainText("Active Mobile");
    await expect(rows.nth(2)).toContainText("Future Mobile");
  });

  test("displays correct status labels with chronological sort", async ({ page }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding();

    const baseDate = new Date();

    const { user: alumniUser } = await usersFactory.create({
      legalName: "Alumni User",
      preferredName: "Alumni",
      countryCode: "US",
    });
    await companyContractorsFactory.createInactive({
      companyId: company.id,
      userId: alumniUser.id,
      startedAt: subDays(baseDate, 50),
      endedAt: subDays(baseDate, 10),
      role: "Alumni Role",
    });

    const { user: activeUser } = await usersFactory.create({
      legalName: "Active User",
      preferredName: "Active",
      countryCode: "US",
    });
    await companyContractorsFactory.create({
      companyId: company.id,
      userId: activeUser.id,
      startedAt: subDays(baseDate, 20),
      role: "Active Role",
    });

    await login(page, adminUser, "/people");

    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByText(/Ended on/)).toBeVisible();
    await expect(page.getByText(/Started on/)).toBeVisible();

    const statusHeader = page.getByRole("columnheader", { name: "Status" });
    await statusHeader.click();
    await page.waitForTimeout(500);

    await expect(page.getByText(/Ended on/)).toBeVisible();
    await expect(page.getByText(/Started on/)).toBeVisible();

    const rows = page.locator("tbody tr");
    await expect(rows.nth(0)).toContainText("Alumni User");
    await expect(rows.nth(1)).toContainText("Active User");
  });
});
