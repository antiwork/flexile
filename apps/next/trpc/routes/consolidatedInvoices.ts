import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { activeStorageAttachments, consolidatedInvoices, consolidatedInvoicesInvoices, invoices } from "@/db/schema";
import { companyProcedure, createRouter, getS3Url } from "@/trpc";

export const consolidatedInvoicesRouter = createRouter({
  last: companyProcedure.query(async ({ ctx }) => {
    if (!ctx.companyAdministrator && !ctx.companyContractor) throw new TRPCError({ code: "FORBIDDEN" });
    const invoice = await db.query.consolidatedInvoices.findFirst({
      columns: { createdAt: true },
      where: eq(consolidatedInvoices.companyId, ctx.company.id),
      orderBy: [desc(consolidatedInvoices.createdAt)],
    });
    return { invoice };
  }),

  list: companyProcedure.query(async ({ ctx }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    const data = await db
      .select({
        id: consolidatedInvoices.id,
        invoiceDate: consolidatedInvoices.invoiceDate,
        totalCents: consolidatedInvoices.totalCents,
        status: consolidatedInvoices.status,
        totalContractors: sql<number>`count(distinct invoices.user_id)`,
      })
      .from(consolidatedInvoices)
      .leftJoin(
        consolidatedInvoicesInvoices,
        eq(consolidatedInvoices.id, consolidatedInvoicesInvoices.consolidatedInvoiceId),
      )
      .leftJoin(invoices, eq(consolidatedInvoicesInvoices.invoiceId, invoices.id))
      .where(eq(consolidatedInvoices.companyId, ctx.company.id))
      .groupBy(consolidatedInvoices.id)
      .orderBy(desc(consolidatedInvoices.invoiceDate));

    const receipts = await db.query.activeStorageAttachments.findMany({
      where: and(
        eq(activeStorageAttachments.recordType, "ConsolidatedInvoice"),
        inArray(
          activeStorageAttachments.recordId,
          data.map((invoice) => invoice.id),
        ),
        eq(activeStorageAttachments.name, "receipt"),
      ),
      with: { blob: true },
    });

    return await Promise.all(
      data.map(async (invoice) => {
        const receipt = receipts.find(({ recordId }) => recordId === invoice.id);
        return {
          ...invoice,
          receiptUrl: receipt ? await getS3Url(receipt.blob.key, receipt.blob.filename) : null,
        };
      }),
    );
  }),
});
