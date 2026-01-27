import { companiesFactory } from "@test/factories/companies";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";

const API_DOMAIN = "localhost:3101";

test.describe("GitHub Account and Organization Connections", () => {
  let adminUser: Awaited<ReturnType<typeof usersFactory.create>>["user"];
  let contractorUser: Awaited<ReturnType<typeof usersFactory.create>>["user"];

  test.beforeEach(async () => {
    // Create company and admin
    const setup = await companiesFactory.createCompletedOnboarding();
    adminUser = setup.adminUser;

    // Create contractor (unlinked)
    const contractorResult = await usersFactory.createContractor();
    contractorUser = contractorResult.user;
  });

  test("user can connect and disconnect GitHub profile", async ({ page }) => {
    await login(page, contractorUser);
    await page.goto("/settings/account");

    await expect(page.getByText("Link your GitHub account to verify ownership of your work.")).toBeVisible();

    // Intercept the GitHub redirect to extract state and prevent external hit
    const githubAuthorizePromise = page.waitForRequest(/.*github\.com\/login\/oauth\/authorize.*/u);
    await page.route(/.*github\.com\/login\/oauth\/authorize.*/u, (route) =>
      route.fulfill({ status: 200, body: "<html>Mock GitHub Page</html>" }),
    );

    await page.getByRole("button", { name: "Connect" }).click();

    const githubRequest = await githubAuthorizePromise;
    const state = new URL(githubRequest.url()).searchParams.get("state");
    expect(state).toBeTruthy();

    const callbackUrl = `http://${API_DOMAIN}/internal/github_connection/callback?code=mock_code&state=${state}`;
    await page.goto(callbackUrl, { waitUntil: "commit" });

    await expect(page.getByText("GitHub account successfully linked.")).toBeVisible();
    await expect(page.getByText("github_dev_user")).toBeVisible(); // Mocked login in backend test mode

    await page.getByRole("button", { name: "github_dev_user" }).click();
    await page.getByText("Disconnect account").click();

    // Confirm in dialog
    await page.getByRole("button", { name: "Disconnect", exact: true }).click();

    await expect(page.getByText("GitHub account disconnected.")).toBeVisible();
    await expect(page.getByText("Link your GitHub account")).toBeVisible();
  });

  test("admin can connect and disconnect GitHub organization", async ({ page }) => {
    await login(page, adminUser);
    await page.goto("/settings/administrator/integrations");

    await expect(page.getByText("Automatically verify contractor pull requests and bounty claims.")).toBeVisible();

    // Intercept the GitHub app installation URL
    const githubInstallPromise = page.waitForRequest(/.*github\.com\/apps\/.*\/installations\/new.*/u);
    await page.route(/.*github\.com\/apps\/.*\/installations\/new.*/u, (route) =>
      route.fulfill({ status: 200, body: "<html>Mock GitHub Page</html>" }),
    );

    await page.getByRole("button", { name: "Connect" }).click();

    const githubRequest = await githubInstallPromise;
    const state = new URL(githubRequest.url()).searchParams.get("state");
    expect(state).toBeTruthy();

    const callbackUrl = `http://${API_DOMAIN}/internal/github_organization_connection/callback?installation_id=987654&state=${state}`;
    await page.goto(callbackUrl, { waitUntil: "commit" });

    await expect(page.getByText("GitHub organization successfully connected.")).toBeVisible();
    await expect(page.getByText("flexile-mock-org")).toBeVisible(); // Mocked org login in backend test mode

    await page.getByRole("button", { name: "flexile-mock-org" }).click();
    await page.getByText("Disconnect").click();

    // Confirm in dialog
    await page.getByRole("button", { name: "Disconnect", exact: true }).click();

    await expect(page.getByText("GitHub organization disconnected.")).toBeVisible();
    await expect(page.getByText("Automatically verify contractor")).toBeVisible();
  });
});
