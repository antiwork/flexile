import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { eq } from "drizzle-orm";
import { companies, companyInvestors, shareClasses, shareHoldings } from "@/db/schema";

test.describe("Cap table creation", () => {
  test("creates cap table with multiple investors", async ({ page }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding({
      equityEnabled: true,
      fullyDilutedShares: BigInt(0), // Will be set by the service
      sharePriceInUsd: "10.00",
    });

    const { user: investor1 } = await usersFactory.create({
      legalName: "Alice Johnson",
      email: "alice@example.com",
    });
    const { user: investor2 } = await usersFactory.create({
      legalName: "Bob Smith",
      email: "bob@example.com",
    });
    await companyContractorsFactory.create({
      companyId: company.id,
      userId: investor1.id,
    });
    await companyContractorsFactory.create({
      companyId: company.id,
      userId: investor2.id,
    });

    await login(page, adminUser);
    await page.goto("/equity/investors");

    await expect(page.getByText("Add your cap table to start managing equity and ownership records.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Add cap table" })).toBeVisible();

    await page.getByRole("link", { name: "Add cap table" }).click();
    await expect(page).toHaveURL("/equity/investors/add");

    await page.getByRole("textbox", { name: "Type to search investors..." }).last().click();
    await page.getByText(investor1.legalName || "").click();
    const row = page.getByRole("row", { name: new RegExp(investor1.legalName || "", "u") });
    await row.getByRole("textbox", { name: "Number of shares" }).fill("100000");

    await page.getByRole("button", { name: "Add new investor" }).click();
    await page.getByRole("textbox", { name: "Type to search investors..." }).last().click();
    await page.getByText(investor2.legalName || "").click();
    const row2 = page.getByRole("row", { name: new RegExp(investor2.legalName || "", "u") });
    await row2.getByRole("textbox", { name: "Number of shares" }).fill("50000");

    await expect(page.getByText("66.7%")).toBeVisible();
    await expect(page.getByText("33.3%")).toBeVisible();

    await page.getByRole("button", { name: "Finalize cap table" }).click();
    await expect(page).toHaveURL("/equity/investors");

    await expect(page.getByText(investor1.legalName || "")).toBeVisible();
    await expect(page.getByText(investor2.legalName || "")).toBeVisible();

    const companyRecord = await db.query.companies.findFirst({
      where: eq(companies.id, company.id),
    });
    expect(companyRecord?.fullyDilutedShares).toBe(BigInt(150000));

    const shareClass = await db.query.shareClasses.findFirst({
      where: eq(shareClasses.companyId, company.id),
    });
    expect(shareClass?.name).toBe("Common");

    const companyInvestorRecords = await db.query.companyInvestors.findMany({
      where: eq(companyInvestors.companyId, company.id),
      with: { user: true },
    });
    expect(companyInvestorRecords).toHaveLength(2);

    const aliceInvestor = companyInvestorRecords.find((ci) => ci.user.legalName === "Alice Johnson");
    const bobInvestor = companyInvestorRecords.find((ci) => ci.user.legalName === "Bob Smith");

    expect(aliceInvestor?.totalShares).toBe(BigInt(100000));
    expect(bobInvestor?.totalShares).toBe(BigInt(50000));

    expect(aliceInvestor).toBeDefined();
    if (!aliceInvestor) throw new Error("Alice investor not found");
    const shareHoldingRecords = await db.query.shareHoldings.findMany({
      where: eq(shareHoldings.companyInvestorId, aliceInvestor.id),
    });
    expect(shareHoldingRecords).toHaveLength(1);
    expect(shareHoldingRecords[0]?.numberOfShares).toBe(100000);
    expect(shareHoldingRecords[0]?.sharePriceUsd).toBe("10.0");
    expect(shareHoldingRecords[0]?.totalAmountInCents).toBe(BigInt(100000000));
  });

  test("validates required fields", async ({ page }) => {
    const { adminUser } = await companiesFactory.createCompletedOnboarding({
      equityEnabled: true,
    });

    await login(page, adminUser);
    await page.goto("/equity/investors/add");

    await page.getByRole("button", { name: "Finalize cap table" }).click();

    await expect(
      page.getByText(
        "Some investor details are missing. Please fill in all required fields before finalizing the cap table.",
      ),
    ).toBeVisible();
  });

  test("validates share amounts", async ({ page }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding({
      equityEnabled: true,
    });

    const { user: investor } = await usersFactory.create({ legalName: "Test Investor", email: "test@example.com" });
    await companyContractorsFactory.create({
      companyId: company.id,
      userId: investor.id,
    });

    await login(page, adminUser);
    await page.goto("/equity/investors/add");

    await page.getByRole("textbox", { name: "Type to search investors..." }).last().click();
    await page.getByText("Test Investor").click();
    const row = page.getByRole("row", { name: new RegExp(investor.legalName || "", "u") });
    await row.getByRole("textbox", { name: "Number of shares" }).fill("0");

    await page.getByRole("button", { name: "Finalize cap table" }).click();

    await expect(
      page.getByText(
        "Some investor details are missing. Please fill in all required fields before finalizing the cap table.",
      ),
    ).toBeVisible();
  });

  test("prevents duplicate investors", async ({ page }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding({
      equityEnabled: true,
    });

    const { user: investor } = await usersFactory.create({ legalName: "Test Investor" });

    await companyContractorsFactory.create({
      companyId: company.id,
      userId: investor.id,
    });

    await db.insert(companyInvestors).values({
      companyId: company.id,
      userId: investor.id,
      investmentAmountInCents: BigInt(1000000),
      totalShares: BigInt(10000),
    });

    await login(page, adminUser);
    await page.goto("/equity/investors/add");

    await page.getByRole("textbox", { name: "Type to search investors..." }).last().click();
    await page.getByText("Test Investor").click();
    const row = page.getByRole("row", { name: new RegExp(investor.legalName || "", "u") });
    await row.getByRole("textbox", { name: "Number of shares" }).fill("5000");

    await page.getByRole("button", { name: "Finalize cap table" }).click();

    await expect(page.getByText("Investor 1: User is already an investor in this company")).toBeVisible();
  });
});
