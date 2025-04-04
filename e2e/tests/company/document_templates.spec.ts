import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";

test.describe("Document templates", () => {
  test("allows viewing and managing document templates", async ({ page, next }) => {
    const docusealData = { documents: [], fields: [], submitters: [], schema: [] };
    next.onFetch(async (request) => {
      if (request.url === "https://docuseal.com/embed/templates/1") {
        return Response.json({ name: "Default consulting agreement", ...docusealData });
      }
      if (request.url === "https://api.docuseal.com/templates/pdf") {
        expect(await request.json()).toMatchObject({ name: "Consulting agreement" });
        return Response.json({ id: 2 });
      }
      if (request.url === "https://docuseal.com/embed/templates/2") {
        return Response.json({ name: "Consulting agreement", ...docusealData });
      }
    });
    const { company } = await companiesFactory.createCompletedOnboarding();
    const { user: adminUser } = await usersFactory.create();
    await companyAdministratorsFactory.create({
      companyId: company.id,
      userId: adminUser.id,
    });

    await login(page, adminUser);
    await page.goto("/document_templates");
    await expect(page.locator("tbody tr")).toHaveCount(1);

    await page.getByRole("link", { name: "Consulting agreement" }).click();
    await expect(
      page.getByText("This is our default template. Replace it with your own to fully customize it."),
    ).toBeVisible();
    await expect(page.getByText("Default Consulting Agreement")).toBeVisible();
    await page.getByRole("button", { name: "Replace default template" }).click();
    await expect(page.getByText("Consulting agreement", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Back to templates" }).click();
    await expect(page.locator("tbody tr")).toHaveCount(1);

    next.onFetch(async (request) => {
      if (request.url === "https://api.docuseal.com/templates/pdf") {
        expect(await request.json()).toMatchObject({ name: "Equity grant contract" });
        return Response.json({ id: 3 });
      }
      if (request.url === "https://docuseal.com/embed/templates/3") {
        return Response.json({ name: "Equity grant contract", ...docusealData });
      }
    });
    await page.getByRole("button", { name: "New template" }).click();
    await expect(
      page.getByText(
        "By creating a custom document template, you acknowledge that Flexile shall not be liable for any claims, liabilities, or damages arising from or related to such documents. See our Terms of Service for more details.",
      ),
    ).toBeVisible();
    await page.getByRole("button", { name: "Equity grant contract" }).click();

    await expect(page.locator("#title_container").getByText("Equity grant contract")).toBeVisible();
    await page.getByRole("link", { name: "Back to templates" }).click();

    await expect(page.locator("tbody tr")).toHaveCount(2);
  });
});
