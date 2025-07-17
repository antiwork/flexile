import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { 
  companyInvestors,
  companyInvestorEntities,
  users,
  shareClasses, 
  shareHoldings, 
  convertibleSecurities,
  convertibleInvestments 
} from "@/db/schema";
import { companyProcedure, createRouter } from "@/trpc";

export const waterfallPlaygroundRouter = createRouter({
  // Get all cap table data needed for waterfall playground
  getCapTableData: companyProcedure.query(async ({ ctx }) => {
    if (!ctx.companyAdministrator && !ctx.companyLawyer) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    try {
      // Fetch all investor entities (non-user investors)
      const investorEntities = await db
        .select()
        .from(companyInvestorEntities)
        .where(eq(companyInvestorEntities.companyId, ctx.company.id));

      // Fetch all user investors with their user data
      const userInvestors = await db
        .select({
          id: companyInvestors.externalId,
          userId: users.externalId,
          name: users.legalName,
          email: users.email,
          totalShares: companyInvestors.totalShares,
          totalOptions: companyInvestors.totalOptions,
        })
        .from(companyInvestors)
        .innerJoin(users, eq(companyInvestors.userId, users.id))
        .where(eq(companyInvestors.companyId, ctx.company.id));

      // Combine both types of investors
      const allInvestors = [
        ...investorEntities.map(inv => ({
          id: inv.externalId,
          name: inv.name || 'Unknown Entity',
          email: inv.email,
          isEntity: true,
        })),
        ...userInvestors.map(inv => ({
          id: inv.id,
          name: inv.name || 'Unknown User',
          email: inv.email,
          isEntity: false,
        })),
      ];

      // Fetch all share classes - start with basic fields
      const shareClassesData = await db
        .select()
        .from(shareClasses)
        .where(eq(shareClasses.companyId, ctx.company.id));

      // Fetch all share holdings
      const shareHoldingsData = await db
        .select()
        .from(shareHoldings)
        .innerJoin(companyInvestors, eq(shareHoldings.companyInvestorId, companyInvestors.id))
        .innerJoin(shareClasses, eq(shareHoldings.shareClassId, shareClasses.id))
        .where(eq(shareClasses.companyId, ctx.company.id));

      // Fetch all convertible securities
      const convertibleSecuritiesData = await db
        .select()
        .from(convertibleSecurities)
        .innerJoin(companyInvestors, eq(convertibleSecurities.companyInvestorId, companyInvestors.id))
        .innerJoin(convertibleInvestments, eq(convertibleSecurities.convertibleInvestmentId, convertibleInvestments.id))
        .where(eq(companyInvestors.companyId, ctx.company.id));

      // Transform the data to a simpler format
      return {
        investors: allInvestors,
        shareClasses: shareClassesData.map(sc => ({
          id: sc.id,
          name: sc.name,
          preferred: sc.preferred || false,
          originalIssuePriceInDollars: sc.originalIssuePriceInDollars,
          // Waterfall terms - these might not exist yet in the database
          liquidationPreferenceMultiple: sc.liquidationPreferenceMultiple || 1.0,
          participating: sc.participating || false,
          participationCapMultiple: sc.participationCapMultiple || null,
          seniorityRank: sc.seniorityRank || 0,
        })),
        shareHoldings: shareHoldingsData.map(sh => ({
          id: sh.share_holdings.id,
          investorId: sh.company_investors.externalId,
          shareClassId: sh.share_holdings.shareClassId,
          numberOfShares: sh.share_holdings.numberOfShares,
          sharePriceUsd: sh.share_holdings.sharePriceUsd,
          totalAmountInCents: sh.share_holdings.totalAmountInCents,
          issuedAt: sh.share_holdings.issuedAt,
        })),
        convertibleSecurities: convertibleSecuritiesData.map(cs => ({
          id: cs.convertible_securities.id,
          investorId: cs.company_investors.externalId,
          convertibleType: cs.convertible_investments.convertibleType,
          principalValueInCents: cs.convertible_securities.principalValueInCents,
          valuationCapInDollars: cs.convertible_investments.valuationCapInDollars,
          discountRate: cs.convertible_investments.discountRate,
          interestRate: cs.convertible_investments.interestRate,
          maturityDate: cs.convertible_investments.maturityDate,
          issuedAt: cs.convertible_securities.issuedAt,
        })),
      };
    } catch (error) {
      console.error('Error fetching cap table data:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch cap table data',
        cause: error,
      });
    }
  }),
});