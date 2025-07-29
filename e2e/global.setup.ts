import { test as setup } from "@playwright/test";
import { db } from "@test/db";
import { sql } from "drizzle-orm";
import { documentTemplates } from "@/db/schema";

setup.describe.configure({ mode: "serial" });

setup("global setup", async () => {
  // Set environment variable for backend to recognize Playwright tests
  process.env.ENABLE_DEFAULT_OTP = "true";

  const result = await db.execute<{ tablename: string }>(
    sql`SELECT tablename FROM pg_tables WHERE schemaname='public'`,
  );

  const tables = result.rows
    .map(({ tablename }) => tablename)
    .filter((name) => !["_drizzle_migrations", "wise_credentials", "users"].includes(name))
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
});
