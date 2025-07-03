import { db, takeOrThrow } from "@test/db";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { equityGrantsFactory } from "@test/factories/equityGrants";
import { shareClassesFactory } from "@test/factories/shareClasses";
import { eq } from "drizzle-orm";
import { companyInvestors, equityGrantExercises, equityGrantExerciseRequests, shareHoldings } from "@/db/schema";
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
      const { shareClass } = await shareClassesFactory.create({
        companyId: investor.companyId,
      });

      const [createdShareHolding] = await db
        .insert(shareHoldings)
        .values({
          companyInvestorId: investor.id,
          companyInvestorEntityId: null,
          shareClassId: shareClass.id,
          name: `C2-${exerciseCounter}`,
          issuedAt: new Date(),
          originallyAcquiredAt: new Date(),
          numberOfShares: 100,
          sharePriceUsd: "10.00",
          totalAmountInCents: BigInt(10000),
          shareHolderName: "Test Holder",
        })
        .returning();
      shareHolding = createdShareHolding;
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
