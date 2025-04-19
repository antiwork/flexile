import type { Page } from "@playwright/test";
import { db } from "@test/db";
import { capTableUploadsFactory } from "@test/factories/capTableUploads";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { findRequiredTableRow } from "@test/helpers/matchers";
import { expect, test } from "@test/index";
import { format } from "date-fns";
import { capTableUploads } from "@/db/schema";

test.describe.configure({ mode: "serial" });

test.describe("Cap table uploads list", () => {
  test("shows empty state when no uploads exist", async ({ page }: { page: Page }) => {
    await db.delete(capTableUploads);
    const { user } = await usersFactory.create({ teamMember: true, invitingCompany: true });

    await login(page, user);
    await page.goto("/cap_table_uploads");

    await expect(page.getByText("No cap table uploads yet")).toBeVisible();
    await expect(page.getByRole("table")).not.toBeVisible();
  });

  test("shows list of uploads with different statuses", async ({ page }: { page: Page }) => {
    await db.delete(capTableUploads);
    const { user } = await usersFactory.create({ teamMember: true, invitingCompany: true });

    // Create test data for different statuses
    const statuses = ["submitted", "processing", "failed"] as const;
    const uploads = await Promise.all(statuses.map(async (status) => capTableUploadsFactory.create({ status })));

    await login(page, user);
    await page.goto("/cap_table_uploads");
    await page.waitForLoadState("networkidle");

    // Test list view shows all uploads
    for (const upload of uploads) {
      const row = await findRequiredTableRow(page, {
        Date: format(upload.uploadedAt, "MMM d, yyyy"),
      });
      await expect(row).toBeVisible();
    }

    // Verify all uploads are shown
    const rows = await page.locator("tbody tr").all();
    expect(rows.length).toBe(uploads.length);
  });
});
