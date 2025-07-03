import { db, takeOrThrow } from "@test/db";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { equityGrantsFactory } from "@test/factories/equityGrants";
import { eq } from "drizzle-orm";
import { companyInvestors, equityGrantExercises, equityGrantExerciseRequests } from "@/db/schema";
import { assert } from "@/utils/assert";

let exerciseCounter = 0;

export const equityGrantExercisesFactory = {
  create: async (
    overrides: Partial<{
      companyInvestorId: bigint;
      companyId: bigint;
      requestedAt: Date;
      numberOfOptions: bigint;
      totalCostCents: bigint;
      status: string;
    }> = {},
    options: { withShareHoldings?: boolean } = {}
  ) => {
    const investor = overrides.companyInvestorId
      ? await db.query.companyInvestors
          .findFirst({
            where: eq(companyInvestors.id, overrides.companyInvestorId),
          })
          .then(takeOrThrow)
      : (await companyInvestorsFactory.create()).companyInvestor;

    exerciseCounter++;

    const [equityGrantExercise] = await db
      .insert(equityGrantExercises)
      .values({
        companyInvestorId: investor.id,
        companyId: investor.companyId,
        requestedAt: overrides.requestedAt || new Date(),
        numberOfOptions: BigInt(overrides.numberOfOptions || 100),
        totalCostCents: BigInt(overrides.totalCostCents || 5000),
        status: overrides.status || "signed",
        bankReference: `REF-${exerciseCounter}`,
      })
      .returning();
    assert(equityGrantExercise != null);

    const { equityGrant } = await equityGrantsFactory.create({
      companyInvestorId: investor.id,
      name: `GUM-${exerciseCounter}`,
      vestedShares: 100,
    });

    let shareHolding = null;
    if (options.withShareHoldings) {
      shareHolding = {
        id: BigInt(exerciseCounter),
        name: `C2-${exerciseCounter}`,
      };
    }

    await db.insert(equityGrantExerciseRequests).values({
      equityGrantId: equityGrant.id,
      equityGrantExerciseId: equityGrantExercise.id,
      shareHoldingId: shareHolding?.id || null,
      numberOfOptions: 100,
      exercisePriceUsd: "5.00",
    });

    return { equityGrantExercise, equityGrant, shareHolding };
  },
};
