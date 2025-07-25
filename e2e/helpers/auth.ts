import { createClerkClient } from "@clerk/backend";
import { clerk } from "@clerk/testing/playwright";
import { type Page } from "@playwright/test";
import { db } from "@test/db";
import { eq } from "drizzle-orm";
import { users } from "@/db/schema";
import { assertDefined } from "@/utils/assert";

let clerkTestUser: { id: string; email: string } | undefined;

export const clearClerkUser = async () => {
  if (clerkTestUser) await db.update(users).set({ clerkId: null }).where(eq(users.clerkId, clerkTestUser.id));
  clerkTestUser = undefined;
};

export const setClerkUser = async (id: bigint) => {
  await clearClerkUser();

  // Create a test user with a unique email that includes +clerk_test subaddress
  const testEmail = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}+clerk_test@example.com`;

  try {
    // Use Clerk's backend client to create a test user
    const clerkClient = createClerkClient({ secretKey: assertDefined(process.env.CLERK_SECRET_KEY) });

    // Check if user already exists and delete it
    const [existingUser] = (await clerkClient.users.getUserList({ emailAddress: [testEmail] })).data;
    if (existingUser) await clerkClient.users.deleteUser(existingUser.id);

    // Create new test user with a completely random password
    const randomPassword = `Test${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}!@#`;
    const testUser = await clerkClient.users.createUser({
      emailAddress: [testEmail],
      password: randomPassword,
    });

    clerkTestUser = {
      id: testUser.id,
      email: testEmail,
    };

    // Update the database user with the Clerk ID
    await db.update(users).set({ clerkId: testUser.id }).where(eq(users.id, id));

    return clerkTestUser;
  } catch (error) {
    console.error("Failed to create Clerk test user:", error);
    throw error;
  }
};

export const login = async (page: Page, user: typeof users.$inferSelect) => {
  await page.goto("/login");

  const clerkUser = await setClerkUser(user.id);
  await clerk.signIn({ page, signInParams: { strategy: "email_code", identifier: clerkUser.email } });

  // Wait for navigation with a more flexible approach
  try {
    await page.waitForURL(/^(?!.*\/login$).*/u, { timeout: 30000 });
  } catch (error) {
    // If timeout, check if we're already on a different page
    const currentUrl = page.url();
    if (!currentUrl.includes("/login")) {
      console.log("Already navigated away from login page");
    } else {
      throw error;
    }
  }
};
