import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PDF_MAX_FILE_SIZE, PDF_MAX_FILE_SIZE_MB } from "@/models/constants";

// Safe wrapper for AI SDK calls to handle type safety issues
interface AIProcessingResult {
  success: boolean;
  data?: z.infer<typeof invoiceSchema>;
  error?: string;
}

const invoiceSchema = z.object({
  invoiceNumber: z.string().optional(),
  invoiceDate: z.string().optional(),
  lineItems: z
    .array(
      z.object({
        description: z.string(),
        quantity: z.number(),
        rate: z.number().optional(),
        amount: z.number().optional(),
      }),
    )
    .optional(),
  expenses: z
    .array(
      z.object({
        description: z.string(),
        amount: z.number(),
        category: z.string().optional(),
      }),
    )
    .optional(),
  notes: z.string().optional(),
});

/**
 * Safely process PDF with AI SDK
 */
async function processWithAI(dataUrl: string): Promise<AIProcessingResult> {
  try {
    // AI SDK operations are isolated here

    const modelInstance = openai("gpt-4o");

    const generation = await generateObject({
      model: modelInstance,
      schema: invoiceSchema,
      messages: [
        {
          role: "system",
          content: `Extract invoice data precisely:
            - Quantities: exact as shown (5 stays 5, not 300)
            - Rates: dollar amounts (e.g., $100.00 → 100)
            - Invoice #: patterns like #1234, INV-1234
            - Dates: YYYY-MM-DD format
            - Each line item separate in array
            - If the document is not an invoice, return empty fields`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract invoice data from this PDF. If this is not an invoice, return empty fields:",
            },
            { type: "image", image: dataUrl },
          ],
        },
      ],
      temperature: 0.1,
    });

    // Validate the response with our schema

    const validatedObject = invoiceSchema.parse(generation.object);

    return {
      success: true,
      data: validatedObject,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to process PDF with AI",
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File) || !file.type.includes("pdf")) {
      return NextResponse.json({ error: "Please provide a valid PDF file" }, { status: 400 });
    }

    // Check file size
    if (file.size > PDF_MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds ${PDF_MAX_FILE_SIZE_MB}MB limit. Please upload a smaller PDF.` },
        { status: 400 },
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 });
    }

    // Convert PDF to base64
    const buffer = Buffer.from(await file.arrayBuffer());
    const dataUrl = `data:application/pdf;base64,${buffer.toString("base64")}`;

    // Process PDF with AI SDK using our safe wrapper
    const aiResult = await processWithAI(dataUrl);

    if (!aiResult.success || !aiResult.data) {
      throw new Error(aiResult.error || "Failed to process PDF with AI");
    }

    const object = aiResult.data;

    // Check if the result contains any meaningful invoice data
    const hasData =
      Boolean(object.invoiceNumber) ||
      Boolean(object.invoiceDate) ||
      Boolean(object.lineItems && object.lineItems.length > 0) ||
      Boolean(object.expenses && object.expenses.length > 0);

    if (!hasData) {
      return NextResponse.json(
        { error: "This PDF doesn't appear to contain invoice data. Please upload a valid invoice PDF." },
        { status: 400 },
      );
    }

    return NextResponse.json(object);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to parse PDF" },
      { status: 500 },
    );
  }
}
