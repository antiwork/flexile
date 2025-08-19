import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test, withinModal } from "@test/index";

test.describe("Document templates", () => {
  test("allows viewing and managing document templates", async ({ page, next }) => {
    const docusealData = { documents: [], fields: [], submitters: [], schema: [] };

    next.onFetch(async (request) => {
      if (request.url === "https://docuseal.com/embed/templates/1") {
        return Response.json({ name: "Default consulting agreement", ...docusealData });
      }

      if (request.url === "https://api.docuseal.com/templates/pdf") {
        const payload: unknown = await request.json();
        if (payload && typeof payload === "object" && "name" in payload) {
          expect(payload).toMatchObject({ name: "Consulting agreement" });
        } else {
          throw new Error("Invalid payload received from /templates/pdf");
        }
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

    await login(page, adminUser, "/documents");
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
    await expect(page.locator("h1").getByText(/edit consulting agreement/iu)).toBeVisible();
    await page.getByRole("link", { name: "Back to documents" }).click();

    await page.getByRole("button", { name: "Edit templates" }).click();
    await withinModal(async (modal) => expect(modal.locator("tbody tr")).toHaveCount(1), { page });
  });
});
