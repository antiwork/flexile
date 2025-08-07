import "server-only";
import { S3Client } from "@aws-sdk/client-s3";
import { getSchema } from "@tiptap/core";
import { generateHTML, generateJSON } from "@tiptap/html";
import { Node } from "@tiptap/pm/model";
import {
  type inferProcedureBuilderResolverOptions,
  type inferRouterInputs,
  type inferRouterOutputs,
  initTRPC,
  TRPCError,
} from "@trpc/server";
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { eq } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { cache } from "react";
import superjson from "superjson";
import { z } from "zod";
import { db } from "@/db";
import { companies, users } from "@/db/schema";
import env from "@/env";
import { authOptions } from "@/lib/auth";
import { assertDefined } from "@/utils/assert";
import { richTextExtensions } from "@/utils/richText";
import { latestUserComplianceInfo, withRoles } from "./routes/users/helpers";
import { type AppRouter } from "./server";

export const createContext = cache(async ({ req }: FetchCreateContextFnOptions) => {
  const host = assertDefined(req.headers.get("Host"));
  const cookie = req.headers.get("cookie") ?? "";
  const userAgent = req.headers.get("user-agent") ?? "";
  const ipAddress = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "";
  const csrfToken = cookie
    .split("; ")
    .find((row) => row.startsWith("X-CSRF-Token="))
    ?.split("=")[1];
  const headers: Record<string, string> = {
    cookie,
    "user-agent": userAgent,
    accept: "application/json",
    ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
  };

  let userId: number | null = null;

  // Get userId from NextAuth JWT session
  const session = await getServerSession(authOptions);
  if (session?.user) {
    // Extract user ID from JWT token
    try {
      const jwt = session.user.jwt;
      const base64Payload = jwt.split(".")[1];
      if (base64Payload) {
        const payload = z
          .object({ user_id: z.number() })
          .safeParse(JSON.parse(Buffer.from(base64Payload, "base64").toString()));
        if (payload.success) userId = payload.data.user_id;
      }
    } catch {}
  }

  return {
    userId,
    host,
    ipAddress,
    userAgent,
    headers,
  };
});
export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create({ transformer: superjson });
export const createRouter = t.router;
export const baseProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

export const s3Client = new S3Client({
  region: env.AWS_REGION,
  credentials: { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY },
});

// TODO switch all stored HTML to use JSON - we should only have to call generateHTML here
export const renderTiptap = (html: string) => generateHTML(generateJSON(html, richTextExtensions), richTextExtensions);
export const renderTiptapToText = (html: string) =>
  Node.fromJSON(getSchema(richTextExtensions), generateJSON(html, richTextExtensions)).textContent;

export const protectedProcedure = baseProcedure
  .input(z.object({ companyId: z.string().nullish() }).optional())
  .use(async (opts) => {
    const { ctx, input } = opts;
    const userId = ctx.userId;
    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    // Calling opts.next in two places doesn't work, so using this slightly awkward function wrapper
    const getContext = async () => {
      if (!input?.companyId) {
        const user = assertDefined(
          await db.query.users.findFirst({
            where: eq(users.id, BigInt(userId)),
            with: { userComplianceInfos: latestUserComplianceInfo },
          }),
        );
        return {
          company: null,
          user,
          companyAdministrator: null,
          companyContractor: null,
          companyInvestor: null,
          companyLawyer: null,
        };
      }
      const company = await db.query.companies.findFirst({ where: eq(companies.externalId, input.companyId) });
      if (!company) throw new TRPCError({ code: "FORBIDDEN" });
      const userWithRoles = assertDefined(
        await db.query.users.findFirst({
          with: {
            ...withRoles(company.id),
            userComplianceInfos: latestUserComplianceInfo,
          },
          where: eq(users.id, BigInt(userId)),
        }),
      );
      const roles = {
        companyAdministrator: userWithRoles.companyAdministrators[0],
        companyContractor: userWithRoles.companyContractors[0],
        companyInvestor: userWithRoles.companyInvestors[0],
        companyLawyer: userWithRoles.companyLawyers[0],
      };
      if (!Object.values(roles).some((role) => role)) throw new TRPCError({ code: "FORBIDDEN" });
      return { company, user: userWithRoles, ...roles };
    };

    return opts.next({ ctx: { ...ctx, userId, ...(await getContext()) } });
  });

export const companyProcedure = protectedProcedure.input(z.object({ companyId: z.string() })).use(async (opts) => {
  const { ctx } = opts;
  if (!ctx.company) throw new TRPCError({ code: "FORBIDDEN" });
  return opts.next({
    ctx: { ...ctx, company: ctx.company },
  });
});

export type ProtectedContext = inferProcedureBuilderResolverOptions<typeof protectedProcedure>["ctx"];
export type CompanyContext = inferProcedureBuilderResolverOptions<typeof companyProcedure>["ctx"];

export type RouterInput = inferRouterInputs<AppRouter>;
export type RouterOutput = inferRouterOutputs<AppRouter>;
