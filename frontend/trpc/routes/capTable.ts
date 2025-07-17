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
  users,
} from "@/db/schema";
import type { CapTableInvestor, CapTableInvestorForAdmin } from "@/models/investor";
import { companyProcedure, createRouter } from "@/trpc";

export const capTableRouter = createRouter({
  showForWaterfall: companyProcedure.query(async ({ ctx }) => {
    const isAdminOrLawyer = !!(ctx.companyAdministrator || ctx.companyLawyer);
    if (!ctx.company.capTableEnabled || !(isAdminOrLawyer || ctx.companyInvestor))
      throw new TRPCError({ code: "FORBIDDEN" });

    // Get detailed share holdings - need to filter through companyInvestor relationship
    const allHoldings = await db.query.shareHoldings.findMany({
      with: {
        companyInvestor: {
          with: {
            user: true,
          },
        },
        shareClass: true,
      },
    });
    
    // Filter holdings to only those belonging to this company
    const holdings = allHoldings.filter(holding => 
      holding.companyInvestor && holding.companyInvestor.companyId === BigInt(ctx.company.id)
    );

    // Get all share classes for the company
    const allShareClasses = await db.query.shareClasses.findMany({
      where: eq(shareClasses.companyId, BigInt(ctx.company.id)),
    });

    // Get all company investors (even those without current holdings)
    const allInvestors = await db.query.companyInvestors.findMany({
      where: eq(companyInvestors.companyId, BigInt(ctx.company.id)),
      with: {
        user: true,
      },
    });

    return {
      shareHoldings: holdings.map(holding => ({
        id: holding.id.toString(),
        numberOfShares: holding.numberOfShares,
        sharePriceUsd: holding.sharePriceUsd?.toString() || '0',
        totalAmountInCents: holding.totalAmountInCents,
        issuedAt: holding.issuedAt.toISOString(),
        companyInvestor: {
          id: holding.companyInvestor.id.toString(),
          user: holding.companyInvestor.user ? {
            name: holding.companyInvestor.user.preferredName || holding.companyInvestor.user.legalName || holding.companyInvestor.user.email || 'Unknown',
            email: holding.companyInvestor.user.email,
            preferredName: holding.companyInvestor.user.preferredName,
            legalName: holding.companyInvestor.user.legalName,
          } : null,
        },
        shareClass: {
          id: holding.shareClass.id.toString(),
          name: holding.shareClass.name,
          originalIssuePriceInDollars: holding.shareClass.originalIssuePriceInDollars?.toString() || '0',
          liquidationPreferenceMultiple: holding.shareClass.liquidationPreferenceMultiple?.toString() || '0',
          participating: holding.shareClass.participating || false,
          participationCapMultiple: holding.shareClass.participationCapMultiple?.toString(),
          seniorityRank: holding.shareClass.seniorityRank || 999,
          preferred: holding.shareClass.preferred || false,
        },
      })),
      shareClasses: allShareClasses.map(sc => ({
        id: sc.id.toString(),
        name: sc.name,
        originalIssuePriceInDollars: sc.originalIssuePriceInDollars?.toString() || '0',
        liquidationPreferenceMultiple: sc.liquidationPreferenceMultiple?.toString() || '0',
        participating: sc.participating || false,
        participationCapMultiple: sc.participationCapMultiple?.toString(),
        seniorityRank: sc.seniorityRank || 999,
        preferred: sc.preferred || false,
      })),
      investors: allInvestors.map(investor => ({
        id: investor.id.toString(),
        user: investor.user ? {
          name: investor.user.preferredName || investor.user.legalName || investor.user.email || 'Unknown',
          email: investor.user.email,
          preferredName: investor.user.preferredName,
          legalName: investor.user.legalName,
        } : null,
      })),
    };
  }),

  show: companyProcedure.input(z.object({ newSchema: z.boolean().optional() })).query(async ({ ctx, input }) => {
    const isAdminOrLawyer = !!(ctx.companyAdministrator || ctx.companyLawyer);
    if (!ctx.company.capTableEnabled || !(isAdminOrLawyer || ctx.companyInvestor))
      throw new TRPCError({ code: "FORBIDDEN" });

    let outstandingShares = BigInt(0);

    const investors: (CapTableInvestor | CapTableInvestorForAdmin)[] = [];
    const investorsConditions = (relation: typeof companyInvestorEntities | typeof companyInvestors) =>
      and(
        eq(relation.companyId, ctx.company.id),
        or(sql`${relation.totalShares} > 0`, sql`${relation.totalOptions} > 0`),
      );

    if (input.newSchema) {
      (
        await db
          .select({
            id: companyInvestorEntities.externalId,
            name: companyInvestorEntities.name,
            outstandingShares: companyInvestorEntities.totalShares,
            fullyDilutedShares: sql<bigint>`${companyInvestorEntities.totalShares} + ${companyInvestorEntities.totalOptions}`,
            notes: companyInvestorEntities.capTableNotes,
            email: companyInvestorEntities.email,
          })
          .from(companyInvestorEntities)
          .where(investorsConditions(companyInvestorEntities))
          .orderBy(desc(companyInvestorEntities.totalShares), desc(companyInvestorEntities.totalOptions))
      ).forEach((investor) => {
        outstandingShares += investor.outstandingShares;
        investors.push({
          ...(isAdminOrLawyer ? investor : omit(investor, "email")),
        });
      });
    } else {
      (
        await db
          .select({
            id: companyInvestors.externalId,
            userId: users.externalId,
            name: sql<string>`COALESCE(${users.legalName}, '')`,
            outstandingShares: companyInvestors.totalShares,
            fullyDilutedShares: companyInvestors.fullyDilutedShares,
            notes: companyInvestors.capTableNotes,

            email: users.email,
          })
          .from(companyInvestors)
          .innerJoin(users, eq(companyInvestors.userId, users.id))
          .where(investorsConditions(companyInvestors))
          .orderBy(desc(companyInvestors.totalShares), desc(companyInvestors.totalOptions))
      ).forEach((investor) => {
        outstandingShares += investor.outstandingShares;
        investors.push(isAdminOrLawyer ? investor : omit(investor, "email"));
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
      investors.push(investment);
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
