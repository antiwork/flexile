import "server-only";
import { and, eq, SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { pick } from "lodash-es";
import env from "@/env";
import * as schema from "./schema";
export const db = drizzle({
  connection: env.DATABASE_URL,
  schema,
  logger: process.env.VERCEL_ENV !== "production" && !process.env.CI,
});

export const byExternalId = (
  table: PgTable & { id: PgColumn; externalId: PgColumn },
  externalId: string,
  where?: SQL,
) =>
  db
    .select(pick(table, "id"))
    .from(table)
    .where(and(eq(table.externalId, externalId), where));
