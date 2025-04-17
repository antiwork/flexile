import { eq } from "drizzle-orm";
import { db } from "@/db";
import { companies } from "@/db/schema";

export const disconnectSlack = async (companyId: bigint) => {
  await db
    .update(companies)
    .set({
      slackBotUserId: null,
    })
    .where(eq(companies.id, companyId));
};
