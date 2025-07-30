import { pdf } from "@react-pdf/renderer";
import { PdfTemplate } from "@/components/InvoiceTemplate/pdf-template";

export interface InvoicePdfData {
  invoiceNumber: string;
  invoiceDate: string;
  paidAt?: string | null;
  billFrom: string;
  billTo: string;
  notes?: string | null;
  totalAmountInUsdCents: bigint;
  cashAmountInCents: bigint;
  equityAmountInCents: bigint;
  equityPercentage: number;
  streetAddress?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  countryCode?: string | null;
  company: {
    name: string;
    streetAddress: string | null;
    city: string | null;
    state: string | null;
    zipCode: string | null;
    countryCode: string | null;
  };
  complianceInfo?:
    | {
        businessEntity: boolean | null;
        legalName: string | null;
      }
    | null
    | undefined;
  lineItems: {
    description: string;
    quantity: number;
    hourly: boolean;
    payRateInSubunits: number;
  }[];
  expenses: {
    description: string;
    totalAmountInCents: bigint;
    expenseCategory: {
      name: string;
    };
  }[];
}

export async function generateInvoicePdf(invoice: InvoicePdfData): Promise<Uint8Array> {
  const pdfElement = PdfTemplate({ invoice });
  const blob = await pdf(pdfElement).toBlob();
  const arrayBuffer = await blob.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

export function downloadInvoicePdf(buffer: Uint8Array, filename: string): void {
  // Convert buffer to blob
  const blob = new Blob([buffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
