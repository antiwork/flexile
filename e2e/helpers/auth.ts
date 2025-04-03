import { clerk } from "@clerk/testing/playwright";
import { type Page } from "@playwright/test";
import { db } from "@test/db";
import { eq } from "drizzle-orm";
import { users } from "@/db/schema";

const clerkTestUsers = [
  { id: "user_2rV0f8ymVAsk3S0V6EhfSiQcGbK", email: "hi1+clerk_test@example.com" },
  { id: "user_2vEWnlPOcxlENwUAXNxdTTLWlHD", email: "hi2+clerk_test@example.com" },
];

const clerkTestUser = clerkTestUsers[Number(process.env.TEST_WORKER_INDEX) - 1];
export const clerkTestId = clerkTestUser?.id ?? "";
export const clerkTestEmail = clerkTestUser?.email ?? "";
export const login = async (page: Page, user: typeof users.$inferSelect) => {
  await db.update(users).set({ clerkId: null }).where(eq(users.clerkId, clerkTestId));
  await db.update(users).set({ clerkId: clerkTestId }).where(eq(users.id, user.id));
  await page.goto("/login");

  await clerk.signIn({ page, signInParams: { strategy: "email_code", identifier: clerkTestEmail } });
  await page.waitForURL(/^(?!.*\/login$).*/u);
};
