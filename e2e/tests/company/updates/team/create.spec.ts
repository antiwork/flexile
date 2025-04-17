import { readFile } from "fs/promises";
import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { companyContractorUpdatesFactory } from "@test/factories/companyContractorUpdates";
import { companyContractorUpdateTasksFactory } from "@test/factories/companyContractorUpdateTasks";
import { githubIntegrationsFactory } from "@test/factories/githubIntegrations";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { startsOn } from "@test/helpers/date";
import { expect, test } from "@test/index";
import { addDays, nextFriday, nextWednesday, startOfWeek, subDays } from "date-fns";
import { format } from "date-fns/format";
import { nextThursday } from "date-fns/nextThursday";
import { nextTuesday } from "date-fns/nextTuesday";
import { z } from "zod";

test.describe("Team member updates page", () => {
  test("view team updates", async ({ page, next }) => {
    const responseParser = z.object({ url: z.string(), data: z.unknown() });
    const mockResponses = await Promise.all(
      ["gh.search.json", "gh.unfurl-issue-open.json", "gh.unfurl-pr-open.json"].map(async (file) =>
        responseParser.parse(JSON.parse(await readFile(`./e2e/samples/githubApi/${file}`, "utf-8"))),
      ),
    );
    next.onFetch((request) => {
      const mockResponse = mockResponses.find((mockResponse) => request.url === mockResponse.url);
      return mockResponse ? Response.json(mockResponse.data) : "continue";
    });

    const context = page.context();
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    const { company } = await companiesFactory.createCompletedOnboarding({ teamUpdatesEnabled: true });
    const { user: contractorUser } = await usersFactory.create({ preferredName: "Sylvester" });
    const { companyContractor } = await companyContractorsFactory.create({
      companyId: company.id,
      userId: contractorUser.id,
    });
    await companyContractorsFactory.create({
      companyId: company.id,
    });

    await githubIntegrationsFactory.create({ companyId: company.id });

    const prevUpdate = await companyContractorUpdatesFactory.create({
      companyContractorId: companyContractor.id,
      periodStartsOn: startsOn(subDays(new Date(), 7)).toDateString(),
    });

    await login(page, contractorUser);
    await page.getByRole("link", { name: "Updates" }).click();

    const thisWeekUpdate = page.locator("form ul");

    // Tasks are visible when they don't have any content
    await expect(thisWeekUpdate.getByPlaceholder("Describe your task")).toHaveCount(1);

    await companyContractorUpdateTasksFactory.create({
      companyContractorUpdateId: prevUpdate.id,
      name: "Last week task 1",
    });
    await companyContractorUpdateTasksFactory.create({
      companyContractorUpdateId: prevUpdate.id,
      name: "Last week task 2",
    });

    // Login and visit page
    await page.reload();

    // This week tasks
    await thisWeekUpdate.getByPlaceholder("Describe your task").first().fill("This week task 1");
    await thisWeekUpdate.getByPlaceholder("Describe your task").nth(1).fill("This week task 2");
    await thisWeekUpdate.getByRole("checkbox").first().click();
    await expect(thisWeekUpdate.getByRole("checkbox").first()).toBeChecked();

    // GitHub search
    await thisWeekUpdate.getByPlaceholder("Describe your task").last().fill("#issues");

    await expect(thisWeekUpdate.locator("[cmdk-list]")).toBeVisible();
    await expect(thisWeekUpdate.locator("[cmdk-item]")).toHaveCount(5);
    await thisWeekUpdate.getByText("#3 Closed issue").click();
    await expect(thisWeekUpdate.locator("[cmdk-list]")).not.toBeVisible();
    await expect(thisWeekUpdate.getByRole("link", { name: "#3 Closed issue" })).toHaveAttribute(
      "href",
      "https://github.com/anti-work-test/flexile/issues/3",
    );

    // GitHub unfurl
    await thisWeekUpdate.getByPlaceholder("Describe your task").last().click();
    await thisWeekUpdate.evaluate(async () => {
      await navigator.clipboard.writeText("https://github.com/antiwork/flexile/pull/3730");
    });
    await page.keyboard.press("ControlOrMeta+v");
    await expect(thisWeekUpdate.getByRole("link", { name: "#3730 Move GitHub endpoints" })).toHaveAttribute(
      "href",
      "https://github.com/antiwork/flexile/pull/3730",
    );

    await thisWeekUpdate.getByPlaceholder("Describe your task").last().click();
    await thisWeekUpdate.evaluate(async () => {
      await navigator.clipboard.writeText("https://github.com/anti-work-test/flexile/issues/1");
    });
    await page.keyboard.press("ControlOrMeta+v");
    await expect(page.getByRole("link", { name: "#1 Open issue" })).toHaveAttribute(
      "href",
      "https://github.com/anti-work-test/flexile/issues/1",
    );

    // Fill in time off
    await expect(page.getByText("Off this week: Sylvester")).not.toBeVisible();
    await page.getByRole("button", { name: "Log time off" }).click();
    const thisWeek = startOfWeek(new Date());
    await page.getByLabel("From").fill(format(nextTuesday(thisWeek), "yyyy-MM-dd"));
    await page.getByLabel("Until").fill(format(nextWednesday(thisWeek), "yyyy-MM-dd"));
    await page.getByRole("button", { name: "Add more" }).click();
    await page
      .getByLabel("From")
      .nth(1)
      .fill(format(nextThursday(thisWeek), "yyyy-MM-dd"));
    await page
      .getByLabel("Until")
      .nth(1)
      .fill(format(nextFriday(thisWeek), "yyyy-MM-dd"));
    await page.getByRole("button", { name: "Save time off" }).click();
    await expect(page.getByRole("button", { name: "Saved!" })).toBeVisible();
    await expect(page.getByText("Off this week: Sylvester")).toBeVisible();

    // Post update
    await expect(page.getByText("Missing updates: Sylvester")).not.toBeVisible();

    // missing update shown after first update is posted
    await expect(page.getByText("Missing updates: Sylvester")).not.toBeVisible();
    await expect(page.getByText("Missing updates: ")).toBeVisible();

    // View updates
    await page.reload();

    await thisWeekUpdate.getByRole("checkbox").last().click();
    await thisWeekUpdate.getByPlaceholder("Describe your task").last().fill("last minute addition");
    await page.waitForTimeout(600);
    await page.reload();

    const updateContainer = page.locator("div:has(hgroup+form)");
    await expect(updateContainer.locator("h2")).toContainText("Sylvester");
    await expect(thisWeekUpdate).toBeVisible();

    // Check input values for this week
    await expect(thisWeekUpdate.getByPlaceholder("Describe your task").nth(0)).toHaveValue("This week task 1");
    await expect(thisWeekUpdate.getByPlaceholder("Describe your task").nth(1)).toHaveValue("This week task 2");
    await expect(thisWeekUpdate.getByRole("link", { name: "#3730 Move GitHub endpoints" })).toBeVisible();
    await expect(thisWeekUpdate.getByRole("link", { name: "#1 Open issue" })).toBeVisible();
    await expect(thisWeekUpdate.getByPlaceholder("Describe your task").nth(2)).toHaveValue("last minute addition");
    await expect(thisWeekUpdate.getByRole("checkbox").first()).toBeChecked();
    await expect(thisWeekUpdate.getByRole("checkbox", { checked: true })).toHaveCount(2);
  });

  test("alumni contractor cannot access updates", async ({ page }) => {
    const { company } = await companiesFactory.createCompletedOnboarding({ teamUpdatesEnabled: true });
    const { user: alumniUser } = await usersFactory.create();
    await companyContractorsFactory.createInactive({
      companyId: company.id,
      userId: alumniUser.id,
    });

    await login(page, alumniUser);

    await expect(page.getByRole("link", { name: "Account" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Updates" })).not.toBeVisible();

    await page.goto("/updates/team");
    await expect(page.getByText("Access denied")).toBeVisible();
  });

  test("contractors with a future end date can access updates", async ({ page }) => {
    const { company } = await companiesFactory.createCompletedOnboarding({ teamUpdatesEnabled: true });
    const { user: alumniUser } = await usersFactory.create();
    await companyContractorsFactory.create({
      companyId: company.id,
      userId: alumniUser.id,
      endedAt: addDays(new Date(), 1),
    });

    await login(page, alumniUser);

    await page.getByRole("link", { name: "Updates" }).click();
    await expect(page.getByText("This week:")).toBeVisible();

    const thisWeekUpdate = page.locator("form ul");
    await thisWeekUpdate.getByPlaceholder("Describe your task").first().fill("new task");
    await page.waitForTimeout(600);
    await page.reload();
    await expect(thisWeekUpdate.getByPlaceholder("Describe your task").first()).toHaveValue("new task");
  });
});
