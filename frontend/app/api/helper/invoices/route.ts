import { verifyHmac } from "@helperai/client/auth";
import { NextRequest, NextResponse } from "next/server";
import env from "@/env";
import { trpc } from "@/trpc/server";

export async function POST(request: NextRequest) {
  const body: unknown = await request.json();

  verifyHmac(body, request.headers.get("authorization"), env.HELPER_HMAC_SECRET);

  const { companyId, contractorId } = Object.fromEntries(request.nextUrl.searchParams.entries());

  if (!companyId || !contractorId) {
    return NextResponse.json({
      success: false,
      error: "Missing companyId or contractorId",
    });
  }

  const invoices = await trpc.invoices.list({ companyId, contractorId });
  return NextResponse.json({
    success: true,
    invoices: invoices.map((invoice) => ({
      id: invoice.id,
      number: invoice.invoiceNumber,
      totalAmountInUsdCents: invoice.totalAmountInUsdCents,
      date: invoice.invoiceDate,
      status: invoice.status,
    })),
  });
}
