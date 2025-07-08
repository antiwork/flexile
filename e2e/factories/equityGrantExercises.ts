import { db, takeOrThrow } from "@test/db";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { eq } from "drizzle-orm";
import { companyInvestors, equityGrantExercises, equityGrantExerciseRequests } from "@/db/schema";
import { assert } from "@/utils/assert";

export const equityGrantExercisesFactory = {
  create: async (
    overrides: Partial<typeof equityGrantExercises.$inferInsert & typeof equityGrantExerciseRequests.$inferInsert> = {},
  ) => {
    const investor = overrides.companyInvestorId
      ? await db.query.companyInvestors
          .findFirst({ where: eq(companyInvestors.id, overrides.companyInvestorId) })
          .then(takeOrThrow)
      : (await companyInvestorsFactory.create(overrides)).companyInvestor;

    const [equityGrantExercise] = await db
      .insert(equityGrantExercises)
      .values({
        companyInvestorId: investor.id,
        companyId: investor.companyId,
        requestedAt: new Date(),
        numberOfOptions: BigInt(100),
        totalCostCents: BigInt(5000),
        status: "signed",
        bankReference: `REF-1`,
        ...overrides,
      })
      .returning();
    assert(equityGrantExercise != null);

    return equityGrantExercise;
  },
};
