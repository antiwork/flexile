import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  activeStorageAttachments,
  activeStorageBlobs,
  consolidatedInvoices,
  consolidatedInvoicesInvoices,
  invoices,
} from "@/db/schema";
import { companyProcedure, createRouter } from "@/trpc";
import { pick } from "lodash-es";

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

    return db
      .select({
        id: consolidatedInvoices.id,
        invoiceDate: consolidatedInvoices.invoiceDate,
        totalCents: consolidatedInvoices.totalCents,
        status: consolidatedInvoices.status,
        totalContractors: sql<number>`count(distinct invoices.user_id)`,
        attachment: pick(activeStorageBlobs, "key", "filename"),
      })
      .from(consolidatedInvoices)
      .leftJoin(
        consolidatedInvoicesInvoices,
        eq(consolidatedInvoices.id, consolidatedInvoicesInvoices.consolidatedInvoiceId),
      )
      .leftJoin(invoices, eq(consolidatedInvoicesInvoices.invoiceId, invoices.id))
      .leftJoin(
        activeStorageAttachments,
        and(
          eq(activeStorageAttachments.recordType, "ConsolidatedInvoice"),
          eq(consolidatedInvoices.id, activeStorageAttachments.recordId),
        ),
      )
      .leftJoin(activeStorageBlobs, eq(activeStorageAttachments.blobId, activeStorageBlobs.id))
      .where(eq(consolidatedInvoices.companyId, ctx.company.id))
      .groupBy(consolidatedInvoices.id, activeStorageBlobs.key, activeStorageBlobs.filename)
      .orderBy(desc(consolidatedInvoices.invoiceDate));
  }),
});
