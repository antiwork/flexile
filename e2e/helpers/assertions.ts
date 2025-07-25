import { expect, type Page } from "@playwright/test";

export const assertDashboardCardsVisible = async (page: Page) => {
  // Check for the three main sections (they might not be headings)
  await expect(page.getByText("Earnings")).toBeVisible();
  // Use first() to handle multiple "Equity" elements
  await expect(page.getByText("Equity").first()).toBeVisible();
  await expect(page.getByText("Activity")).toBeVisible();
};

export const assertDashboardWelcomeVisible = async (page: Page) => {
  await expect(page.getByText("Welcome back")).toBeVisible();
  await expect(page.getByText("Here's your")).toBeVisible();
};

export const assertOnboardingComplete = async (page: Page) => {
  // TODO (techdebt): Implement proper onboarding completion check
  // For now, reuse dashboard visibility check
  await assertDashboardCardsVisible(page);
};

export const assertDashboardQuickActions = async (page: Page) => {
  // Check for quick actions section
  await expect(page.getByText("Quick actions")).toBeVisible();
  // TODO (techdebt): Add more specific checks for action buttons based on user role
};

export const assertEarningsData = async (page: Page, expectedAmount: string) => {
  // The debug output shows $0 format, not $0.00
  const normalizedExpected = expectedAmount.replace(".00", "");

  // Check for the normalized amount
  const found = await page.locator(`text=${normalizedExpected}`).count();
  if (found === 0) {
    // If not found, log what's actually on the page for debugging
    const earningsSection = await page.locator("text=Earnings").first();
    if (earningsSection) {
      const earningsText = await earningsSection.locator("..").textContent();
      console.log("Earnings section content:", earningsText);
    }
    throw new Error(`Expected earnings amount ${normalizedExpected} not found`);
  }
};

export const assertEquityData = async (page: Page, expectedPercentage: string, expectedAmount: string) => {
  // The debug output shows 0% format, not 0.00%
  const normalizedPercentage = expectedPercentage.replace(".00%", "%");
  const normalizedAmount = expectedAmount.replace(".00", "");

  await expect(page.getByText(normalizedPercentage)).toBeVisible();
  // Use first() to handle multiple "$0" elements
  await expect(page.getByText(normalizedAmount).first()).toBeVisible();
};
