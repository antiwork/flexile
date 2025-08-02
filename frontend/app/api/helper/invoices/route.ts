import { verifyHmac } from "@helperai/client/auth";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import env from "@/env";
import { createServerCaller } from "@/trpc/server";

const bodySchema = z.object({
  email: z.string().nullable(),
});

export async function POST(request: NextRequest) {
  const rawBody: unknown = await request.json();
  verifyHmac(rawBody, request.headers.get("authorization"), env.HELPER_HMAC_SECRET);

  const { companyId, contractorId } = Object.fromEntries(request.nextUrl.searchParams.entries());

  if (!companyId || !contractorId) {
    return NextResponse.json({
      success: false,
      error: "Missing companyId or contractorId",
    });
  }

  const { email } = bodySchema.parse(rawBody);
  const user = email ? await db.query.users.findFirst({ where: eq(users.email, email) }) : null;

  if (!user) {
    return NextResponse.json({
      success: false,
      error: "User not found",
    });
  }

  const trpc = createServerCaller({ userId: Number(user.id) });
  const invoices = await trpc.invoices.list({ companyId, contractorId });
  return NextResponse.json({
    success: true,
    invoices: invoices.map((invoice) => ({
      id: invoice.id,
      number: invoice.invoiceNumber,
      totalAmountInUsdCents: Number(invoice.totalAmountInUsdCents),
      date: invoice.invoiceDate,
      status: invoice.status,
    })),
  });
}
