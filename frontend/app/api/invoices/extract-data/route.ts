import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";

const extractionSchema = z.object({
  is_invoice: z.boolean().describe("Whether this document is an invoice"),
  confidence: z.number().min(0).max(100).describe("Confidence level 0-100"),
  invoice_number: z.string().nullable().describe("Invoice number if found"),
  invoice_date: z.string().nullable().describe("Invoice date in YYYY-MM-DD format"),
  total_amount: z.number().nullable().describe("Total amount of the invoice"),
  line_items: z
    .array(
      z.object({
        description: z.string().describe("Description of the line item"),
        quantity: z.number().describe("Quantity of the item"),
        rate: z.number().describe("Rate per unit"),
      }),
    )
    .nullable()
    .describe("Array of line items from the invoice"),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("pdf");
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "No PDF file provided" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { success: false, error: "Invalid PDF file. File must be a PDF under 10MB." },
        { status: 400 },
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      // 10MB limit
      return NextResponse.json(
        { success: false, error: "Invalid PDF file. File must be a PDF under 10MB." },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await generateObject({
      model: openai("gpt-5-nano-2025-08-07"),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: 'Analyze this document. Return JSON with these exact fields:\n\n{\n  "is_invoice": boolean,\n  "confidence": 0-100,\n  "invoice_number": string or null,\n  "invoice_date": "YYYY-MM-DD" or null,\n  "total_amount": number or null,\n  "line_items": array or null\n}\n\nIf is_invoice is false, set all invoice fields to null. Only extract invoice data if you\'re confident this is actually an invoice.',
            },
            {
              type: "file",
              data: buffer,
              mediaType: "application/pdf",
            },
          ],
        },
      ],
      schema: extractionSchema,
    });

    const extractedData = result.object;

    if (extractedData.is_invoice === false) {
      return NextResponse.json({
        success: false,
        error: "This document does not appear to be an invoice",
      });
    }

    if (
      (!extractedData.invoice_number || extractedData.invoice_number.trim().length === 0) &&
      (!extractedData.total_amount || extractedData.total_amount === 0) &&
      (!extractedData.line_items || extractedData.line_items.length === 0)
    ) {
      return NextResponse.json({
        success: false,
        error: "This document does not appear to be an invoice",
      });
    }

    return NextResponse.json({ success: true, data: extractedData });
  } catch (error) {
    // eslint-disable-next-line no-console -- Error logging is necessary for debugging
    console.error("PDF extraction failed:", error);

    if (error instanceof Error) {
      if (error.message.includes("timeout") || error.message.includes("Timeout")) {
        return NextResponse.json(
          {
            success: false,
            error: "Request timed out. Please try again.",
          },
          { status: 504 },
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: "Unable to extract invoice data",
      },
      { status: 500 },
    );
  }
}
