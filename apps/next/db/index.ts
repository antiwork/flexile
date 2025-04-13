import "server-only";
import { and, eq,     SQL }   from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import {      PgColumn, PgTable } from "drizzle-orm/pg-core";
import { pick    } from   "lodash-es";
import { z    } from "zod";
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

export const paginationSchema = z.object({ page: z.number(), perPage: z.number() }).or(z.object({}));
export const pagination = (obj: z.infer<typeof paginationSchema>) => ({
  ...("page" in obj ? { offset: (obj.page - 1) * obj.perPage, limit: obj.perPage } : {}),
});
export const paginate = <T extends { limit: (limit: number) => { offset: (offset: number) => unknown } }>(
  query: T,
  obj: z.infer<typeof paginationSchema>,
): T | (T extends { limit: (limit: number) => { offset: (offset: number) => infer R } } ? R : never) =>
  // @ts-expect-error -- this isn't worth typing correctly, but it works!
  "page" in obj ? query.limit(obj.perPage).offset((obj.page - 1) * obj.perPage) : query;
