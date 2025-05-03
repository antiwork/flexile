import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { optionPoolsFactory } from "@test/factories/optionPools";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { range } from "lodash-es";
test.describe("Cap table upload", () => {
  test("allows admin to upload cap table files", async ({ page, next }) => {
    let slackJson: unknown;
    next.onFetch(async (request) => {
      if (request.method === "POST" && request.url.startsWith("https://hooks.slack.com/services/")) {
        slackJson = await request.json();
        return new Response();
      }
    });
    const { company } = await companiesFactory.create();
    const { user: adminUser } = await usersFactory.create();
    await companyAdministratorsFactory.create({
      companyId: company.id,
      userId: adminUser.id,
    });

    await login(page, adminUser);
    await page.goto("/administrator/settings/equity");

    const fileInput = page.getByLabel("Upload files");

    await fileInput.setInputFiles(
      range(1, 6).map((i) => ({
        name: `file${i}.xlsx`,
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        buffer: Buffer.from("test"),
      })),
    );
    await expect(page.getByText("You can only upload up to 4 files")).toBeVisible();

    await fileInput.setInputFiles([
      {
        name: "cap_table.xlsx",
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        buffer: Buffer.from("test"),
      },
    ]);

    await expect(page.getByText("cap_table.xlsx")).toBeVisible();
    await page.getByRole("button", { name: "Upload files", exact: true }).click();
    await expect(page.getByText("We are currently processing your equity documents")).toBeVisible();
    await expect(page.getByText("Upload files")).not.toBeVisible();
    await expect
      .poll(() => slackJson)
      .toMatchObject({
        text: `New cap table upload requested by ${adminUser.email} of ${company.name}.\nView all cap table uploads at https://test.flexile.dev:3101/cap_table_uploads`,
      });
  });

  test("does not show the cap table upload button when the company has equity-related data", async ({ page }) => {
    const { company } = await companiesFactory.create();
    const { user } = await usersFactory.create();
    await companyAdministratorsFactory.create({
      companyId: company.id,
      userId: user.id,
    });
    await optionPoolsFactory.create({
      companyId: company.id,
    });

    await login(page, user);
    await page.goto(`/administrator/settings/equity`);

    await expect(page.getByText("Import equity documents")).not.toBeVisible();
  });
});
