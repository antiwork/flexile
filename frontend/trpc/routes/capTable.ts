import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, or, sql, sum } from "drizzle-orm";
import { omit, pick } from "lodash-es";
import { z } from "zod";
import { db } from "@/db";
import {
  companyInvestorEntities,
  companyInvestors,
  convertibleInvestments,
  equityGrants,
  optionPools,
  shareClasses,
  shareHoldings,
} from "@/db/schema";
import type { CapTableInvestor, CapTableInvestorForAdmin } from "@/models/investor";
import { companyProcedure, createRouter } from "@/trpc";

function groupShareClassHoldings(
  investor: (typeof companyInvestors.$inferSelect | typeof companyInvestorEntities.$inferSelect) & {
    shareHoldings: (typeof shareHoldings.$inferSelect & { shareClass: { name: string } })[];
  },
) {
  return investor.shareHoldings.reduce<{ shareClassName: string; numberOfShares: number }[]>((acc, holding) => {
    const existing = acc.find((h) => h.shareClassName === holding.shareClass.name);
    if (existing) {
      existing.numberOfShares += holding.numberOfShares;
    } else {
      acc.push({
        shareClassName: holding.shareClass.name,
        numberOfShares: holding.numberOfShares,
      });
    }
    return acc;
  }, []);
}

export const capTableRouter = createRouter({
  show: companyProcedure.input(z.object({ newSchema: z.boolean().optional() })).query(async ({ ctx, input }) => {
    const isAdminOrLawyer = !!(ctx.companyAdministrator || ctx.companyLawyer);
    if (!ctx.company.capTableEnabled || !(isAdminOrLawyer || ctx.companyInvestor))
      throw new TRPCError({ code: "FORBIDDEN" });

    let outstandingShares = BigInt(0);

    type InvestorWithHoldings = (CapTableInvestor | CapTableInvestorForAdmin) & {
      shareClassHoldings: { shareClassName: string; numberOfShares: number }[];
    };

    const investors: InvestorWithHoldings[] = [];
    const investorsConditions = (relation: typeof companyInvestorEntities | typeof companyInvestors) =>
      and(
        eq(relation.companyId, ctx.company.id),
        or(sql`${relation.totalShares} > 0`, sql`${relation.totalOptions} > 0`),
      );

    if (input.newSchema) {
      (
        await db.query.companyInvestorEntities.findMany({
          where: investorsConditions(companyInvestorEntities),
          with: {
            shareHoldings: {
              with: {
                shareClass: true,
              },
            },
          },
          orderBy: [desc(companyInvestorEntities.totalShares), desc(companyInvestorEntities.totalOptions)],
        })
      ).forEach((investor) => {
        outstandingShares += investor.totalShares;

        const investorData = {
          id: investor.externalId,
          name: investor.name,
          outstandingShares: investor.totalShares,
          fullyDilutedShares: investor.totalShares + investor.totalOptions,
          notes: investor.capTableNotes,
          email: investor.email,
          shareClassHoldings: groupShareClassHoldings(investor),
        };

        investors.push(isAdminOrLawyer ? investorData : omit(investorData, "email"));
      });
    } else {
      (
        await db.query.companyInvestors.findMany({
          where: investorsConditions(companyInvestors),
          with: {
            user: true,
            shareHoldings: {
              with: {
                shareClass: true,
              },
            },
          },
          orderBy: [desc(companyInvestors.totalShares), desc(companyInvestors.totalOptions)],
        })
      ).forEach((investor) => {
        outstandingShares += investor.totalShares;

        const investorData = {
          id: investor.externalId,
          userId: investor.user.externalId,
          name: investor.user.legalName || "",
          outstandingShares: investor.totalShares,
          fullyDilutedShares: investor.fullyDilutedShares,
          notes: investor.capTableNotes,
          email: investor.user.email,
          shareClassHoldings: groupShareClassHoldings(investor),
        };

        investors.push(isAdminOrLawyer ? investorData : omit(investorData, "email"));
      });
    }

    (
      await db
        .select({
          name: sql<string>`CONCAT(${convertibleInvestments.entityName}, ' ', ${convertibleInvestments.convertibleType})`,
        })
        .from(convertibleInvestments)
        .where(eq(convertibleInvestments.companyId, ctx.company.id))
        .orderBy(desc(convertibleInvestments.impliedShares))
    ).forEach((investment) => {
      investors.push({
        ...investment,
        shareClassHoldings: [],
      });
    });

    const pools = await db
      .select({
        id: optionPools.id,
        shareClassId: optionPools.shareClassId,
        name: optionPools.name,
        availableShares: optionPools.availableShares,
      })
      .from(optionPools)
      .where(eq(optionPools.companyId, ctx.company.id));

    const classes = await Promise.all(
      (
        await db
          .select({ id: shareClasses.id, name: shareClasses.name })
          .from(shareClasses)
          .where(eq(shareClasses.companyId, ctx.company.id))
      ).map(async (shareClass) => {
        const [holdings] = await db
          .select({ outstandingShares: sum(shareHoldings.numberOfShares).mapWith(Number) })
          .from(shareHoldings)
          .where(eq(shareHoldings.shareClassId, shareClass.id));
        const outstandingShares = holdings?.outstandingShares ?? 0;
        const poolIds = pools.filter((pool) => pool.shareClassId === shareClass.id).map((pool) => pool.id);
        const [grants] = await db
          .select({
            exercisableShares: sum(sql`${equityGrants.vestedShares} + ${equityGrants.unvestedShares}`).mapWith(Number),
          })
          .from(equityGrants)
          .where(inArray(equityGrants.optionPoolId, poolIds));
        const exercisableShares = grants?.exercisableShares ?? 0;
        return {
          name: shareClass.name,
          outstandingShares,
          fullyDilutedShares: outstandingShares + exercisableShares,
        };
      }),
    );

    return {
      investors,
      fullyDilutedShares: ctx.company.fullyDilutedShares,
      outstandingShares,

      optionPools: pools.map((pool) => pick(pool, ["name", "availableShares"])),
      shareClasses: classes,
    };
  }),
});
