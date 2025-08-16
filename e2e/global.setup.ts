import { test as setup } from "@playwright/test";
import { db } from "@test/db";
import { sql } from "drizzle-orm";
import { documentTemplates } from "@/db/schema";
import { startServer } from "./mocks/server";

setup.describe.configure({ mode: "serial" });

setup("global setup", async () => {
  /* ----------------------------------------------------------
   * Initialise MSW (Mock Service Worker) so that every network
   * request during Playwright runs is intercepted and mocked.
   * This removes the need for real Stripe/Wise credentials and
   * guarantees deterministic, fast tests.
   * -------------------------------------------------------- */
  if (process.env.NODE_ENV === "test") {
    try {
      // Start MSW server (see e2e/mocks/server.ts)
      startServer();
      // eslint-disable-next-line no-console
      console.log("[E2E] 🛰️  MSW server started – API requests will be mocked");
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[E2E] ❌ Failed to start MSW server:", err);
      throw err;
    }
  }

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
    docusealId: BigInt(1),
    signable: true,
  });
});
