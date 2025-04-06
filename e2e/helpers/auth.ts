import { clerk } from "@clerk/testing/playwright";
import { type Page } from "@playwright/test";
import { db } from "@test/db";
import { eq } from "drizzle-orm";
import { users } from "@/db/schema";
import { assertDefined } from "@/utils/assert";

const clerkTestUsers = [
  { id: "user_2rV0f8ymVAsk3S0V6EhfSiQcGbK", email: "hi1+clerk_test@example.com" },
  { id: "user_2vEWnlPOcxlENwUAXNxdTTLWlHD", email: "hi2+clerk_test@example.com" },
  { id: "user_2vNAyVNltrKLy3YXFki6M6YhemM", email: "hi3+clerk_test@example.com" },
  { id: "user_2vNFwz9EONQUFm7BGe48EHIZZGa", email: "hi4+clerk_test@example.com" },
];
let clerkTestUser: (typeof clerkTestUsers)[number] | undefined;

export const clearClerkUser = async () => {
  if (clerkTestUser) await db.update(users).set({ clerkId: null }).where(eq(users.clerkId, clerkTestUser.id));
  clerkTestUser = undefined;
};

export const setClerkUser = async (id: bigint) => {
  await clearClerkUser();
  for (const user of clerkTestUsers) {
    try {
      await db.update(users).set({ clerkId: user.id }).where(eq(users.id, id));
      clerkTestUser = user;
      break;
    } catch {}
  }
  return assertDefined(clerkTestUser);
};

export const login = async (page: Page, user: typeof users.$inferSelect) => {
  await page.goto("/login");

  const clerkUser = await setClerkUser(user.id);
  await clerk.signIn({ page, signInParams: { strategy: "email_code", identifier: clerkUser.email } });
  await page.waitForURL(/^(?!.*\/login$).*/u);
};
