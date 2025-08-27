import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import env from "@/env";

const extractedInvoiceDataSchema = z.object({
  invoice_date: z.string().describe("The date the invoice was issued, formatted as YYYY-MM-DD."),
  invoice_number: z.string().describe("A unique identifier for this invoice."),
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
export type InvoiceExtractionResult = z.infer<typeof invoiceExtractionResultSchema>;
const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File size exceeds the 10MB limit" }, { status: 400 });
    }

    const { id: fileId } = await openai.files.create({
      file,
      purpose: "user_data",
    });

    const completion = await openai.chat.completions.parse({
      model: "gpt-5-2025-08-07",
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
  } catch {
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
