import { createClerkClient } from "@clerk/backend";
import { clerkSetup } from "@clerk/testing/playwright";
import { test as setup } from "@playwright/test";
import { db } from "@test/db";
import { sql } from "drizzle-orm";
import { documentTemplates } from "@/db/schema";
import { assertDefined } from "@/utils/assert";

setup.describe.configure({ mode: "serial" });

setup("global setup", async () => {
  const result = await db.execute<{ tablename: string }>(
    sql`SELECT tablename FROM pg_tables WHERE schemaname='public'`,
  );

  const tables = result.rows
    .map(({ tablename }) => tablename)
    .filter((name) => !["_drizzle_migrations", "wise_credentials"].includes(name))
    .map((name) => `"public"."${name}"`);
  await db.execute(sql`TRUNCATE TABLE ${sql.raw(tables.join(","))} CASCADE;`);

  await db.insert(documentTemplates).values({
    name: "Consulting agreement",
    externalId: "isz30o7a9e3sm",
    createdAt: new Date(),
    updatedAt: new Date(),
    type: 0,
    docusealId: 1n,
    signable: true,
  });

  // Clean up existing Clerk test users to prevent hitting quota (with timeout)
  try {
    const clerkClient = createClerkClient({ secretKey: assertDefined(process.env.CLERK_SECRET_KEY) });
    const users = await clerkClient.users.getUserList({ limit: 50 }); // Reduced limit

    let deletedCount = 0;
    const maxDeletions = 20; // Limit deletions to prevent long delays

    for (const user of users.data) {
      if (deletedCount >= maxDeletions) break;

      // Check if this is a test user (contains +clerk_test in email)
      const emailAddresses = user.emailAddresses || [];
      const isTestUser = emailAddresses.some((email) => email.emailAddress.includes("+clerk_test"));

      if (isTestUser) {
        try {
          await clerkClient.users.deleteUser(user.id);
          deletedCount++;
          if (deletedCount % 5 === 0) {
            console.log(`Deleted ${deletedCount} test users...`);
          }
        } catch (error) {
          console.log(`Failed to delete test user ${user.id}:`, error);
        }
      }
    }

    if (deletedCount > 0) {
      console.log(`Cleaned up ${deletedCount} Clerk test users`);
    }
  } catch (error) {
    console.log("Failed to clean up Clerk test users:", error);
  }

  await clerkSetup();
});
