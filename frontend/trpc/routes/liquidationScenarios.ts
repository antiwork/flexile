import { createRouter, companyProcedure } from "../index";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "@/db";
import { liquidationScenarios, liquidationPayouts, companyInvestors, users } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";

const createLiquidationScenarioSchema = createInsertSchema(liquidationScenarios).pick({
  name: true,
  description: true,
  exitAmountCents: true,
  exitDate: true,
}).extend({
  exitAmountCents: z.coerce.bigint().positive(),
  exitDate: z.string().datetime(),
});

export const liquidationScenariosRouter = createRouter({
  run: companyProcedure
    .input(createLiquidationScenarioSchema)
    .mutation(async ({ ctx, input }) => {
      // Check authorization - only administrators can create scenarios
      if (!ctx.companyAdministrator) {
        throw new TRPCError({ 
          code: "FORBIDDEN",
          message: "Only administrators can create liquidation scenarios" 
        });
      }

      // Create scenario in database
      const [scenario] = await db
        .insert(liquidationScenarios)
        .values({
          companyId: BigInt(ctx.company.id),
          externalId: `ls_${Math.random().toString(36).substring(2, 15)}`, // Simple ID generation
          name: input.name,
          description: input.description,
          exitAmountCents: input.exitAmountCents,
          exitDate: new Date(input.exitDate),
          status: "draft",
        })
        .returning();

      // TODO: Call Rails backend to run calculation service
      // This would normally be an API call to Rails:
      // await fetch(`${RAILS_API_URL}/api/liquidation_scenarios/${scenario.id}/calculate`, { method: 'POST' })
      
      // For now, return the created scenario
      return {
        id: scenario.id.toString(),
        externalId: scenario.externalId,
        name: scenario.name,
        description: scenario.description,
        exitAmountCents: scenario.exitAmountCents.toString(),
        exitDate: scenario.exitDate.toISOString(),
        status: scenario.status,
        createdAt: scenario.createdAt.toISOString(),
        updatedAt: scenario.updatedAt.toISOString(),
      };
    }),

  show: companyProcedure
    .input(z.object({
      scenarioId: z.string(), // Can be either id or externalId
    }))
    .query(async ({ ctx, input }) => {
      // Try to parse as bigint for numeric ID
      const isNumericId = /^\d+$/.test(input.scenarioId);
      
      const scenario = await db.query.liquidationScenarios.findFirst({
        where: and(
          eq(liquidationScenarios.companyId, BigInt(ctx.company.id)),
          isNumericId 
            ? eq(liquidationScenarios.id, BigInt(input.scenarioId))
            : eq(liquidationScenarios.externalId, input.scenarioId)
        ),
        with: {
          liquidationPayouts: {
            with: {
              companyInvestor: {
                with: {
                  user: true,
                },
              },
            },
          },
        },
      });

      if (!scenario) {
        throw new TRPCError({ 
          code: "NOT_FOUND",
          message: "Liquidation scenario not found" 
        });
      }

      // Transform the data to match frontend expectations
      return {
        id: scenario.id.toString(),
        externalId: scenario.externalId,
        name: scenario.name,
        description: scenario.description,
        exitAmountCents: scenario.exitAmountCents.toString(),
        exitDate: scenario.exitDate.toISOString(),
        status: scenario.status,
        createdAt: scenario.createdAt.toISOString(),
        updatedAt: scenario.updatedAt.toISOString(),
        payouts: scenario.liquidationPayouts.map(payout => ({
          id: payout.id.toString(),
          investorName: payout.companyInvestor.user?.name || "Unknown",
          shareClass: payout.shareClass,
          securityType: payout.securityType,
          numberOfShares: payout.numberOfShares?.toString(),
          payoutAmountCents: payout.payoutAmountCents.toString(),
          liquidationPreferenceAmount: payout.liquidationPreferenceAmount,
          participationAmount: payout.participationAmount,
          commonProceedsAmount: payout.commonProceedsAmount,
        })),
      };
    }),

  list: companyProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const scenarios = await db.query.liquidationScenarios.findMany({
        where: eq(liquidationScenarios.companyId, BigInt(ctx.company.id)),
        orderBy: [desc(liquidationScenarios.createdAt)],
        limit: input.limit,
        offset: input.offset,
      });

      return scenarios.map(scenario => ({
        id: scenario.id.toString(),
        externalId: scenario.externalId,
        name: scenario.name,
        exitAmountCents: scenario.exitAmountCents.toString(),
        exitDate: scenario.exitDate.toISOString(),
        status: scenario.status,
        createdAt: scenario.createdAt.toISOString(),
      }));
    }),
});
