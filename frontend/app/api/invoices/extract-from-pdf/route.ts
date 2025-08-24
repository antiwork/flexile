import OpenAI from "openai";
import env from "@/env";
import { NextRequest, NextResponse } from "next/server";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

const extractedInvoiceDataSchema = z.object({
  invoice_date: z.string().describe("The date the invoice was issued, formatted as YYYY-MM-DD."),
  invoice_number: z.string().describe("A unique identifier for this invoice."),
  notes: z.string().nullable().describe("Additional notes or comments related to the invoice."),
  line_items: z.array(
    z.object({
      description: z.string().describe("Details of the product or service being billed."),
      quantity: z.string().nullable().describe("The number of units or minutes for this line item."),
      pay_rate_in_subunits: z.number().describe("The payment rate for this item in the smallest currency unit."),
      hourly: z.boolean().describe("Whether the item is billed on an hourly basis."),
    }),
  ),
});

const invoiceExtractionResultSchema = z.object({
  is_invoice: z.boolean().describe("Whether the document is an invoice."),
  invoice: extractedInvoiceDataSchema,
});

export type ExtractedInvoiceData = z.infer<typeof extractedInvoiceDataSchema>;
export type InvoiceExtractionResult = z.infer<typeof invoiceExtractionResultSchema>;

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const { id: fileId } = await openai.files.create({
      file: file,
      purpose: "user_data",
    });

    const completion = await openai.chat.completions.parse({
      model: "gpt-4o-2024-08-06",
      messages: [
        { role: "system", content: "You are an assistant that extracts invoice data." },
        {
          role: "user",
          content: [
            { type: "text", text: "Please extract the invoice details from the provided PDF." },
            {
              type: "file",
              file: {
                file_id: fileId,
              },
            },
          ],
        },
      ],
      response_format: zodResponseFormat(invoiceExtractionResultSchema, "invoice"),
    });

    const data = completion.choices[0]?.message.parsed;

    if (!data?.is_invoice)
      return NextResponse.json(
        { error: "We couldn't spot an invoice in that file. Make sure you uploaded the right PDF and try again." },
        { status: 400 },
      );

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
