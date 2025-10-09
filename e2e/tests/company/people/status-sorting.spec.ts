import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { addDays } from "date-fns";

test.describe("People Status Column Sorting", () => {
  test("sorts contractors by date in ascending and descending order on desktop", async ({ page }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding();

    // Create contractors with specific dates for predictable sorting
    await companyContractorsFactory.createInactive({
      companyId: company.id,
      role: "Alumni Old",
      startedAt: new Date("2022-01-01"),
      endedAt: new Date("2023-01-01"),
    });
    await companyContractorsFactory.createInactive({
      companyId: company.id,
      role: "Alumni New",
      startedAt: new Date("2022-06-01"),
      endedAt: new Date("2024-01-01"),
    });
    await companyContractorsFactory.create({
      companyId: company.id,
      role: "Active Old",
      startedAt: new Date("2023-05-01"),
    });
    await companyContractorsFactory.create({
      companyId: company.id,
      role: "Active New",
      startedAt: new Date("2024-05-01"),
    });

    await login(page, adminUser, "/people");

    // Wait for specific content to be visible
    await expect(page.getByText("Alumni Old")).toBeVisible();

    const getRowText = async () => await page.locator("tbody tr").allInnerTexts();
    const statusHeader = page.getByRole("columnheader", { name: "Status" }).getByRole("img");

    // First click - chronological order (oldest to newest)
    await statusHeader.click();

    let rows = await getRowText();
    expect(rows[0]).toContain("Alumni Old"); // ended Jan 1, 2023
    expect(rows[1]).toContain("Active Old"); // started May 1, 2023
    expect(rows[2]).toContain("Alumni New"); // ended Jan 1, 2024
    expect(rows[3]).toContain("Active New"); // started May 1, 2024

    // Second click - reverse chronological (newest to oldest)
    await statusHeader.click();

    rows = await getRowText();
    expect(rows[0]).toContain("Active New"); // started May 1, 2024
    expect(rows[1]).toContain("Alumni New"); // ended Jan 1, 2024
    expect(rows[2]).toContain("Active Old"); // started May 1, 2023
    expect(rows[3]).toContain("Alumni Old"); // ended Jan 1, 2023
  });

  test("sorts contractors by date on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const { company, adminUser } = await companiesFactory.createCompletedOnboarding();

    // Create contractors with specific dates
    await companyContractorsFactory.createInactive({
      companyId: company.id,
      role: "Alumni Mobile",
      startedAt: new Date("2022-01-01"),
      endedAt: new Date("2023-12-01"),
    });
    await companyContractorsFactory.create({
      companyId: company.id,
      role: "Active Mobile",
      startedAt: new Date("2024-01-01"),
    });
    await companyContractorsFactory.create({
      companyId: company.id,
      role: "Future Mobile",
      startedAt: addDays(new Date(), 5),
    });

    await login(page, adminUser, "/people");

    // Wait for specific content to be visible
    await expect(page.getByText("Alumni Mobile")).toBeVisible();

    const rows = page.locator("tbody tr");
    await expect(rows).toHaveCount(3);

    // Check initial chronological order
    const rowText = await rows.allInnerTexts();
    expect(rowText[0]).toContain("Alumni Mobile"); // ended Dec 2023
    expect(rowText[1]).toContain("Active Mobile"); // started Jan 2024
    expect(rowText[2]).toContain("Future Mobile"); // starts in future
  });

  test("displays correct status labels with chronological sort", async ({ page }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding();

    const { user: alumniUser } = await usersFactory.create({
      legalName: "Test Alumni",
      preferredName: "Alumni",
      countryCode: "US",
    });
    await companyContractorsFactory.createInactive({
      companyId: company.id,
      userId: alumniUser.id,
      startedAt: new Date("2023-01-01"),
      endedAt: new Date("2023-12-01"),
      role: "Developer",
    });

    const { user: activeUser } = await usersFactory.create({
      legalName: "Test Active",
      preferredName: "Active",
      countryCode: "US",
    });
    await companyContractorsFactory.create({
      companyId: company.id,
      userId: activeUser.id,
      startedAt: new Date("2024-01-01"),
      role: "Engineer",
    });

    await login(page, adminUser, "/people");

    // Wait for specific content to be visible
    await expect(page.getByText("Test Alumni")).toBeVisible();

    await expect(page.getByText(/Ended on/u)).toBeVisible();
    await expect(page.getByText(/Started on/u)).toBeVisible();

    const rows = page.locator("tbody tr");
    await expect(rows).toHaveCount(2);

    // Check chronological order
    const rowText = await rows.allInnerTexts();
    expect(rowText[0]).toContain("Test Alumni"); // ended Dec 2023
    expect(rowText[1]).toContain("Test Active"); // started Jan 2024
  });
});
