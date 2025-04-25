import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test, withinModal } from "@test/index";

test.describe("Document templates", () => {
  test("allows viewing and managing document templates", async ({ page, next }) => {
    const docusealData = { documents: [], fields: [], submitters: [], schema: [] };
    let expectedTemplateName = "Consulting agreement"; // Initial expected name

    next.onFetch(async (request) => {
      // Load default template
      if (request.url === "https://docuseal.com/embed/templates/1") {
        return Response.json({ name: "Default consulting agreement", ...docusealData });
      }
      // Create/Replace template API call
      if (request.url === "https://api.docuseal.com/templates/pdf") {
        const payload: unknown = await request.json();
        if (payload && typeof payload === "object" && "name" in payload) {
          expect(payload).toMatchObject({ name: expectedTemplateName });
        } else {
          throw new Error("Invalid payload received from /templates/pdf");
        }
        if (expectedTemplateName === "Consulting agreement") {
          return Response.json({ id: 2 }); // ID for replaced template
        } else if (expectedTemplateName === "Equity grant contract") {
          return Response.json({ id: 3 }); // ID for new template
        }
      }
      // Load replaced template
      if (request.url === "https://docuseal.com/embed/templates/2") {
        return Response.json({ name: "Consulting agreement", ...docusealData });
      }
      // Load new equity template
      if (request.url === "https://docuseal.com/embed/templates/3") {
        return Response.json({ name: "Equity grant contract", ...docusealData });
      }
    });

    const { company } = await companiesFactory.createCompletedOnboarding();
    const { user: adminUser } = await usersFactory.create();
    await companyAdministratorsFactory.create({
      companyId: company.id,
      userId: adminUser.id,
    });

    await login(page, adminUser);
    await page.goto("/documents");
    await page.getByRole("button", { name: "Edit templates" }).click();
    await withinModal(
      async (modal) => {
        await expect(modal.locator("tbody tr")).toHaveCount(1);
        await modal.getByRole("link", { name: "Consulting agreement" }).click();
      },
      { page },
    );

    await expect(
      page.getByText("This is our default template. Replace it with your own to fully customize it."),
    ).toBeVisible();
    await expect(page.getByText(/default consulting agreement/iu)).toBeVisible();
    await page.getByRole("button", { name: "Replace default template" }).click();
    // Wait for the main page title to update after replacement
    await expect(page.locator("h1").getByText(/edit consulting agreement/iu)).toBeVisible();
    await page.getByRole("link", { name: "Back to documents" }).click();

    // Update the expected name for the next template creation
    expectedTemplateName = "Equity grant contract";

    await page.getByRole("button", { name: "Edit templates" }).click();
    await withinModal(
      async (modal) => {
        await expect(modal.locator("tbody tr")).toHaveCount(1);
        await expect(
          modal.getByText(
            "By creating a custom document template, you acknowledge that Flexile shall not be liable for any claims, liabilities, or damages arising from or related to such documents. See our Terms of Service for more details.",
          ),
        ).toBeVisible();
        await modal.getByRole("button", { name: "Equity grant contract" }).click();
      },
      { page },
    );

    // Check the main page title rendered by MainLayout
    await expect(page.locator("h1").getByText(/equity grant contract/iu)).toBeVisible();
    await page.getByRole("link", { name: "Back to documents" }).click();

    await page.getByRole("button", { name: "Edit templates" }).click();
    await withinModal(async (modal) => expect(modal.locator("tbody tr")).toHaveCount(2), { page });
  });
});
