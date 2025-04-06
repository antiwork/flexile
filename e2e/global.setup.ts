import { clerkSetup } from "@clerk/testing/playwright";
import { test as setup } from "@playwright/test";
import { db } from "@test/db";
import { sql } from "drizzle-orm";
import { documentTemplates, wiseCredentials } from "@/db/schema";
import env from "@/env";

setup.describe.configure({ mode: "serial" });

setup("global setup", async () => {
  const result = await db.execute<{ tablename: string }>(
    sql`SELECT tablename FROM pg_tables WHERE schemaname='public'`,
  );

  const tables = result.rows.map(({ tablename }) => tablename).map((name) => `"public"."${name}"`);

  await db.execute(sql`TRUNCATE TABLE ${sql.raw(tables.join(","))} CASCADE;`);
  await db.insert(wiseCredentials).values({ profileId: env.WISE_PROFILE_ID, apiKey: env.WISE_API_KEY });

  await db.insert(documentTemplates).values({
    name: "Consulting agreement",
    externalId: "isz30o7a9e3sm",
    createdAt: new Date(),
    updatedAt: new Date(),
    type: 0,
    docusealId: 1n,
    signable: true,
  });

  await clerkSetup();
});
