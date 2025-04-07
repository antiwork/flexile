import { TRPCError } from "@trpc/server";
import { and, desc, eq, exists, isNull } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { pick } from "lodash-es";
import OpenAI from "openai";
import { z } from "zod";
import { db } from "@/db";
import { RoleApplicationStatus } from "@/db/enums";
import { companyAdministrators, companyRoleApplications, companyRoleRates, companyRoles, users } from "@/db/schema";
import env from "@/env";
import { baseProcedure, companyProcedure, createRouter, type RouterInput } from "@/trpc";
import { sendEmails } from "@/trpc/email";
import { companyName } from "@/trpc/routes/companies";
import { assertDefined } from "@/utils/assert";
import { calculateAnnualCompensation } from "./helpers";
import JobApplication from "./JobApplication";

export const roleApplicationsRouter = createRouter({
  list: companyProcedure.input(z.object({ roleId: z.bigint() })).query(async ({ ctx, input }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    return await db
      .select(pick(companyRoleApplications, "id", "name", "createdAt", "hoursPerWeek"))
      .from(companyRoleApplications)
      .innerJoin(companyRoles, eq(companyRoleApplications.companyRoleId, companyRoles.id))
      .where(
        and(
          eq(companyRoles.companyId, ctx.company.id),
          eq(companyRoleApplications.companyRoleId, input.roleId),
          eq(companyRoleApplications.status, RoleApplicationStatus.Pending),
          isNull(companyRoleApplications.deletedAt),
        ),
      );
  }),
  get: companyProcedure.input(z.object({ id: z.bigint() })).query(async ({ ctx, input }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    const [application] = await db
      .select({
        ...pick(
          companyRoleApplications,
          "name",
          "description",
          "hoursPerWeek",
          "weeksPerYear",
          "countryCode",
          "email",
          "createdAt",
          "equityPercent",
        ),
        role: {
          id: companyRoles.externalId,
          ...pick(companyRoleRates, "payRateInSubunits", "trialPayRateInSubunits", "payRateType"),
        },
      })
      .from(companyRoleApplications)
      .innerJoin(companyRoles, eq(companyRoleApplications.companyRoleId, companyRoles.id))
      .innerJoin(companyRoleRates, eq(companyRoles.id, companyRoleRates.companyRoleId))
      .orderBy(desc(companyRoleRates.createdAt))
      .limit(1)
      .where(
        and(
          eq(companyRoles.companyId, ctx.company.id),
          eq(companyRoleApplications.id, input.id),
          isNull(companyRoleApplications.deletedAt),
        ),
      );
    if (!application) throw new TRPCError({ code: "NOT_FOUND" });
    return application;
  }),
  reject: companyProcedure.input(z.object({ id: z.bigint() })).mutation(async ({ ctx, input }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    const [result] = await db
      .update(companyRoleApplications)
      .set({ status: RoleApplicationStatus.Denied })
      .where(
        and(
          eq(companyRoleApplications.id, input.id),
          exists(
            db
              .select()
              .from(companyRoles)
              .where(
                and(
                  eq(companyRoles.id, companyRoleApplications.companyRoleId),
                  eq(companyRoles.companyId, ctx.company.id),
                ),
              ),
          ),
        ),
      )
      .returning();
    if (!result) throw new TRPCError({ code: "NOT_FOUND" });
    return result;
  }),
  create: baseProcedure
    .input(
      createInsertSchema(companyRoleApplications)
        .pick({
          name: true,
          email: true,
          description: true,
          countryCode: true,
          hoursPerWeek: true,
          weeksPerYear: true,
          equityPercent: true,
        })
        .required()
        .extend({ companyRoleId: z.string() }),
    )
    .mutation(async ({ ctx, input }) => {
      const role = await db.query.companyRoles.findFirst({
        where: and(eq(companyRoles.externalId, input.companyRoleId), eq(companyRoles.activelyHiring, true)),
        with: {
          company: true,
          rates: {
            orderBy: [desc(companyRoleRates.createdAt)],
            limit: 1,
          },
        },
      });

      if (!role) throw new TRPCError({ code: "NOT_FOUND" });
      const name = assertDefined(companyName(role.company));

      const shouldDismiss = await assessJobApplication(name, role, input);
      const [application] = await db
        .insert(companyRoleApplications)
        .values({
          ...input,
          companyRoleId: role.id,
          status: shouldDismiss ? RoleApplicationStatus.Denied : RoleApplicationStatus.Pending,
        })
        .returning();
      if (!application || shouldDismiss) return;

      const administrators = await db
        .select({ email: users.email })
        .from(companyAdministrators)
        .innerJoin(users, eq(users.id, companyAdministrators.userId))
        .where(eq(companyAdministrators.companyId, role.companyId));

      if (administrators.length > 0) {
        const rate = assertDefined(role.rates[0]);
        const annualCompensation = calculateAnnualCompensation({ role: rate, application: input });
        await sendEmails(
          {
            from: `${name} via Flexile <support@${env.DOMAIN}>`,
            replyTo: input.email,
            subject: `New application from ${input.name} for ${role.name}`,
            react: JobApplication({
              application,
              company: role.company,
              annualCompensation,
              host: ctx.host,
            }),
          },
          administrators,
        );
      }
    }),
});

type CompanyRole = typeof companyRoles.$inferSelect;
const assessJobApplication = async (
  companyName: string,
  role: CompanyRole,
  input: RouterInput["roles"]["applications"]["create"],
) => {
  const systemPrompt = `You are a hiring manager at ${companyName} and have received a job application
for the role of ${role.name}. Your job is to assess the application and decide whether to dismiss it.

The reasons to dismiss the application are:
incorrect use of English, typos, complete name not given, company names not capitalized correctly, and spam.

The application may contain some HTML tags, please ignore them.

Would you dismiss the application? Reply with YES or NO.`;

  const userPrompt = `Name: ${input.name}\n\n${input.description}`;

  const openai = new OpenAI();
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0,
    max_tokens: 2,
  });

  return response.choices[0]?.message.content?.trim() === "YES";
};
