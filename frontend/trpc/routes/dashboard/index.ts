import { format } from "date-fns";
import { and, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { db } from "@/db";
import { companyInvestors, documents, documentSignatures, equityGrants, invoiceLineItems, invoices } from "@/db/schema";
import { createRouter, protectedProcedure } from "@/trpc";

export const dashboardRouter = createRouter({
  monthlyStats: protectedProcedure.query(async ({ ctx }) => {
    // Return default data if no company context (new user)
    if (!ctx.company) {
      return {
        currentMonth: {
          totalAmount: 0,
          cashAmount: 0,
          equityAmount: 0,
          invoiceCount: 0,
          paidCount: 0,
        },
        previousMonth: {
          totalAmount: 0,
        },
        paymentStatus: "paid" as const,
      };
    }

    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Get current month invoices for the user
    const currentMonthInvoices = await db.query.invoices.findMany({
      where: and(
        eq(invoices.companyId, BigInt(ctx.company.id)),
        eq(invoices.userId, BigInt(ctx.user.id)),
        gte(invoices.invoiceDate, format(currentMonthStart, "yyyy-MM-dd")),
        lte(invoices.invoiceDate, format(currentMonthEnd, "yyyy-MM-dd")),
        isNull(invoices.deletedAt),
      ),
      columns: {
        totalAmountInUsdCents: true,
        cashAmountInCents: true,
        equityAmountInCents: true,
        status: true,
        paidAt: true,
      },
    });

    // Get previous month invoices for the user
    const previousMonthInvoices = await db.query.invoices.findMany({
      where: and(
        eq(invoices.companyId, BigInt(ctx.company.id)),
        eq(invoices.userId, BigInt(ctx.user.id)),
        gte(invoices.invoiceDate, format(previousMonthStart, "yyyy-MM-dd")),
        lte(invoices.invoiceDate, format(previousMonthEnd, "yyyy-MM-dd")),
        isNull(invoices.deletedAt),
      ),
      columns: {
        totalAmountInUsdCents: true,
      },
    });

    // Calculate current month totals
    const currentMonthTotal = currentMonthInvoices.reduce(
      (sum, invoice) => sum + invoice.totalAmountInUsdCents,
      BigInt(0),
    );
    const currentMonthCash = currentMonthInvoices.reduce((sum, invoice) => sum + invoice.cashAmountInCents, BigInt(0));
    const currentMonthEquity = currentMonthInvoices.reduce(
      (sum, invoice) => sum + invoice.equityAmountInCents,
      BigInt(0),
    );
    const currentMonthPaid = currentMonthInvoices.filter((invoice) => invoice.paidAt !== null).length;
    const currentMonthInvoiceCount = currentMonthInvoices.length;

    // Calculate previous month total
    const previousMonthTotal = previousMonthInvoices.reduce(
      (sum, invoice) => sum + invoice.totalAmountInUsdCents,
      BigInt(0),
    );

    // Determine payment status based on current month invoices
    const hasUnpaidInvoices = currentMonthInvoices.some(
      (invoice) => invoice.status === "received" || invoice.status === "approved" || invoice.status === "processing",
    );
    const paymentStatus = hasUnpaidInvoices ? ("pending" as const) : ("paid" as const);

    return {
      currentMonth: {
        totalAmount: Number(currentMonthTotal),
        cashAmount: Number(currentMonthCash),
        equityAmount: Number(currentMonthEquity),
        invoiceCount: currentMonthInvoiceCount,
        paidCount: currentMonthPaid,
      },
      previousMonth: {
        totalAmount: Number(previousMonthTotal),
      },
      paymentStatus,
    };
  }),

  equityProgress: protectedProcedure.query(async ({ ctx }) => {
    // Return default data if no company context (new user)
    if (!ctx.company) {
      return {
        percentage: 0,
        vestedAmount: 0,
        totalGrants: 0,
        recentGrants: 0,
      };
    }

    // Get equity grants through companyInvestors join
    const equityGrantsData = await db
      .select({
        vestedShares: equityGrants.vestedShares,
        numberOfShares: equityGrants.numberOfShares,
        sharePriceUsd: equityGrants.sharePriceUsd,
        createdAt: equityGrants.createdAt,
      })
      .from(equityGrants)
      .innerJoin(companyInvestors, eq(equityGrants.companyInvestorId, companyInvestors.id))
      .where(
        and(
          eq(companyInvestors.companyId, BigInt(ctx.company.id)),
          eq(companyInvestors.userId, BigInt(ctx.user.id)),
          isNull(equityGrants.cancelledAt),
        ),
      );

    if (equityGrantsData.length === 0) {
      return {
        percentage: 0,
        vestedAmount: 0,
        totalGrants: 0,
        recentGrants: 0,
      };
    }

    // Calculate total vested shares and total shares
    const totalVestedShares = equityGrantsData.reduce((sum, grant) => sum + grant.vestedShares, 0);
    const totalShares = equityGrantsData.reduce((sum, grant) => sum + grant.numberOfShares, 0);

    // Calculate percentage (avoid division by zero)
    const percentage = totalShares > 0 ? Math.round((totalVestedShares / totalShares) * 100 * 10) / 10 : 0;

    // Calculate vested amount in cents (assuming share price is in USD)
    const vestedAmount = equityGrantsData.reduce((sum, grant) => {
      const grantVestedAmount = grant.vestedShares * Number(grant.sharePriceUsd) * 100; // Convert to cents
      return sum + grantVestedAmount;
    }, 0);

    // Count recent grants (created in the last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentGrants = equityGrantsData.filter((grant) => new Date(grant.createdAt) > thirtyDaysAgo).length;

    return {
      percentage,
      vestedAmount: Math.round(vestedAmount),
      totalGrants: equityGrantsData.length,
      recentGrants,
    };
  }),

  workActivity: protectedProcedure.query(async ({ ctx }) => {
    // Return default data if no company context (new user)
    if (!ctx.company) {
      return {
        hoursLogged: 0,
        timeEntries: 0,
        invoicesSubmitted: 0,
        documentsToSign: 0,
      };
    }

    // Get documents that need signing for this user
    const unsignedDocuments = await db.query.documents.findMany({
      where: and(eq(documents.companyId, BigInt(ctx.company.id)), isNull(documents.deletedAt)),
      with: {
        signatures: {
          where: eq(documentSignatures.userId, BigInt(ctx.user.id)),
        },
      },
    });

    // Count documents that need signing (documents where user has no signature or signature is not signed)
    const documentsToSign = unsignedDocuments.filter((doc) => {
      const userSignature = doc.signatures.find((sig) => sig.userId === BigInt(ctx.user.id));
      return !userSignature || userSignature.signedAt === null;
    }).length;

    // Get current month invoices to count submissions
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const currentMonthInvoices = await db.query.invoices.findMany({
      where: and(
        eq(invoices.companyId, BigInt(ctx.company.id)),
        eq(invoices.userId, BigInt(ctx.user.id)),
        gte(invoices.invoiceDate, format(currentMonthStart, "yyyy-MM-dd")),
        lte(invoices.invoiceDate, format(currentMonthEnd, "yyyy-MM-dd")),
        isNull(invoices.deletedAt),
      ),
      columns: {
        id: true,
      },
    });

    // Calculate hours logged from invoice line items
    const invoiceIds = currentMonthInvoices.map((invoice) => invoice.id);
    let hoursLogged = 0;

    if (invoiceIds.length > 0) {
      const lineItems = await db.query.invoiceLineItems.findMany({
        where: and(inArray(invoiceLineItems.invoiceId, invoiceIds), eq(invoiceLineItems.hourly, true)),
        columns: {
          quantity: true,
        },
      });

      hoursLogged = lineItems.reduce((sum, item) => sum + item.quantity, 0);
    }

    return {
      hoursLogged,
      timeEntries: currentMonthInvoices.length, // Using invoice count as time entries
      invoicesSubmitted: currentMonthInvoices.length,
      documentsToSign,
    };
  }),
});
