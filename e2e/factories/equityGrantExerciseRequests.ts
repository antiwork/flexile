import { db, takeOrThrow } from "@test/db";
import { equityGrantExercisesFactory } from "@test/factories/equityGrantExercises";
import { equityGrantsFactory } from "@test/factories/equityGrants";
import { eq } from "drizzle-orm";
import { equityGrantExerciseRequests, equityGrantExercises, equityGrants } from "@/db/schema";
import { assert } from "@/utils/assert";

export const equityGrantExerciseRequestsFactory = {
  create: async (overrides: Partial<typeof equityGrantExerciseRequests.$inferInsert> = {}) => {
    const equityGrant = overrides.equityGrantId
      ? await db.query.equityGrants.findFirst({ where: eq(equityGrants.id, overrides.equityGrantId) }).then(takeOrThrow)
      : (await equityGrantsFactory.create()).equityGrant;
    const equityGrantExercise = overrides.equityGrantExerciseId
      ? await db.query.equityGrantExercises
          .findFirst({ where: eq(equityGrantExercises.id, overrides.equityGrantExerciseId) })
          .then(takeOrThrow)
      : await equityGrantExercisesFactory.create();
    const [equityGrantExerciseRequest] = await db
      .insert(equityGrantExerciseRequests)
      .values({
        equityGrantId: equityGrant.id,
        equityGrantExerciseId: equityGrantExercise.id,
        numberOfOptions: 100,
        exercisePriceUsd: "5.00",
        ...overrides,
      })
      .returning();
    assert(equityGrantExerciseRequest != null);
  },
};
