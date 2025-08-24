"use client";

import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { AlertCircle, CheckCircle, FileText, Loader2, Upload, X } from "lucide-react";
import React, { useCallback, useRef, useState } from "react";
import { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import clientEnv from "@/env/client";

// Schema for AI extraction
const invoiceDataSchema = z.object({
  isInvoice: z.boolean().describe("Whether this document is actually an invoice/receipt/bill (true) or not (false)"),
  description: z.string().describe("Brief description of services/work performed"),
  quantity: z.string().describe("Number of hours worked OR quantity of items/services as a string"),
  hourly: z.boolean().describe("Whether this is hourly work (true) or project-based/fixed (false)"),
  payRateInSubunits: z.number().describe("Hourly rate or unit price in cents (multiply dollars by 100)"),
  invoiceDate: z.string().describe("Invoice date in YYYY-MM-DD format"),
});

interface ExtractedInvoiceData {
  isInvoice: boolean;
  description: string;
  quantity: string;
  hourly: boolean;
  payRateInSubunits: number;
  invoiceDate: string;
}

interface InvoiceDocumentDropZoneProps {
  onDataExtracted: (data: Omit<ExtractedInvoiceData, "isInvoice">) => void;
  disabled?: boolean;
}

type DropZoneState = "idle" | "processing" | "success" | "error" | "not-invoice";

export default function InvoiceDocumentDropZone({ onDataExtracted, disabled = false }: InvoiceDocumentDropZoneProps) {
  const [state, setState] = useState<DropZoneState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [extractedData, setExtractedData] = useState<ExtractedInvoiceData | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openaiProvider = createOpenAI({
    apiKey: clientEnv.NEXT_PUBLIC_OPENAI_API_KEY || "",
  });

  // Document processing using AI SDK
  const processDocument = async (file: File): Promise<ExtractedInvoiceData> => {
    if (!clientEnv.NEXT_PUBLIC_OPENAI_API_KEY) {
      throw new Error(
        "OpenAI API key is not configured. Please add NEXT_PUBLIC_OPENAI_API_KEY to your environment variables.",
      );
    }

    let fileData: string;
    let contentType: "image" | "file";

    try {
      if (file.type.startsWith("image/")) {
        fileData = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            if (typeof reader.result === "string") {
              resolve(reader.result);
            } else {
              reject(new Error("Failed to read image file"));
            }
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        contentType = "image";
      } else if (file.type === "application/pdf") {
        const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            if (reader.result instanceof ArrayBuffer) {
              resolve(reader.result);
            } else {
              reject(new Error("Failed to read PDF file"));
            }
          };
          reader.onerror = reject;
          reader.readAsArrayBuffer(file);
        });

        const uint8Array = new Uint8Array(arrayBuffer);
        const binaryString = Array.from(uint8Array, (byte) => String.fromCharCode(byte)).join("");
        fileData = btoa(binaryString);
        contentType = "file";
      } else if (file.type === "text/plain") {
        fileData = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            if (typeof reader.result === "string") {
              resolve(reader.result);
            } else {
              reject(new Error("Failed to read text file"));
            }
          };
          reader.onerror = reject;
          reader.readAsText(file);
        });
        contentType = "file";
      } else {
        throw new Error("Unsupported file type. Please upload an image, PDF, or text file.");
      }
    } catch (_error) {
      throw new Error("Failed to read the file. Please try a different file.");
    }

    try {
      const result = await generateObject({
        model: openaiProvider("gpt-4o-mini"),
        schema: invoiceDataSchema,
        maxRetries: 0,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `FIRST: Determine if this document is an invoice, receipt, bill, or work statement.

If it's NOT an invoice/receipt/bill, set isInvoice=false and provide placeholder values for other fields.

If it IS an invoice/receipt/bill, set isInvoice=true and extract these fields accurately:
- description: Brief description of the work/service
- quantity: Number as a string (hours worked or quantity of items)
- hourly: Boolean - true if hourly work, false if fixed price/project
- payRateInSubunits: Rate in cents (dollars × 100)
- invoiceDate: Date in YYYY-MM-DD format

Rules for invoice extraction:
- For hourly work: set hourly=true, extract hours and hourly rate
- For fixed projects: set hourly=false, quantity="1", extract total amount
- Convert all dollar amounts to cents (multiply by 100)
- Use today's date if no date is visible: ${new Date().toISOString().split("T")[0]}
- Be precise with numbers shown in the document

Examples of invoices: service bills, contractor invoices, freelance receipts, work statements
Examples of non-invoices: personal photos, random documents, contracts without billing info`,
              },
              ...(contentType === "image"
                ? [
                    {
                      type: "image" as const,
                      image: fileData.includes(",") ? fileData.split(",")[1] || "" : fileData,
                    },
                  ]
                : [
                    {
                      type: "file" as const,
                      data: fileData,
                      mediaType: file.type,
                      filename: file.name,
                    },
                  ]),
            ],
          },
        ],
      });

      let extractedData = result.object;
      if (
        extractedData &&
        typeof extractedData === "object" &&
        "properties" in extractedData &&
        extractedData.properties
      ) {
        const properties = extractedData.properties;
        if (
          properties &&
          typeof properties === "object" &&
          "isInvoice" in properties &&
          "description" in properties &&
          "quantity" in properties &&
          "hourly" in properties &&
          "payRateInSubunits" in properties &&
          "invoiceDate" in properties
        ) {
          extractedData = {
            isInvoice: Boolean(properties.isInvoice),
            description: String(properties.description),
            quantity: String(properties.quantity),
            hourly: Boolean(properties.hourly),
            payRateInSubunits: Number(properties.payRateInSubunits),
            invoiceDate: String(properties.invoiceDate),
          };
        }
      }

      // Validate extracted data
      if (!extractedData || typeof extractedData !== "object") {
        throw new Error("Unable to analyze the document. Please try a clearer image or different file.");
      }

      if (!extractedData.isInvoice) {
        throw new Error("NOT_INVOICE");
      }

      if (extractedData.payRateInSubunits < 0 || extractedData.payRateInSubunits > 100000000) {
        throw new Error("Invalid payment amount detected in the document.");
      }

      const quantityNum = parseFloat(extractedData.quantity);
      if (isNaN(quantityNum) || quantityNum <= 0 || quantityNum > 10000) {
        throw new Error("Invalid quantity/hours detected in the document.");
      }

      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/u.test(extractedData.invoiceDate)) {
        throw new Error("Invalid or missing date in the document.");
      }

      return extractedData;
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "NOT_INVOICE") {
          throw error;
        }
        throw new Error(`AI processing failed: ${error.message}`);
      }
      throw new Error("Failed to process the document. Please try again or contact support.");
    }
  };

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      if (files.length === 0 || disabled) return;

      const file = files[0];
      if (!file) return;

      setFileName(file.name);

      // Validate file type
      const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf", "text/plain"];
      if (!validTypes.includes(file.type)) {
        setErrorMessage("Invalid file format. Please upload an image (JPG, PNG, WebP), PDF, or text file.");
        setState("error");
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        setErrorMessage("File too large. Please upload a file smaller than 10MB.");
        setState("error");
        return;
      }

      setState("processing");
      setErrorMessage("");

      try {
        const data = await processDocument(file);
        setExtractedData(data);
        setState("success");
        // Remove isInvoice from the data passed to parent
        const { isInvoice, ...invoiceData } = data;
        onDataExtracted(invoiceData);
      } catch (error) {
        if (error instanceof Error && error.message === "NOT_INVOICE") {
          setState("not-invoice");
          setErrorMessage(
            "This doesn't appear to be an invoice or receipt. Please upload a billing document with payment information.",
          );
        } else {
          setState("error");
          setErrorMessage(error instanceof Error ? error.message : "Failed to process document. Please try again.");
        }
      }
    },
    [onDataExtracted, disabled],
  );

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        setIsDragActive(true);
      }
    },
    [disabled],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget;
    const relatedTarget = e.relatedTarget;
    if (relatedTarget && target instanceof Node && relatedTarget instanceof Node && !target.contains(relatedTarget)) {
      setIsDragActive(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);

      if (!disabled && e.dataTransfer.files) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [disabled, handleFiles],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        handleFiles(e.target.files);
      }
    },
    [handleFiles],
  );

  const handleClick = useCallback(() => {
    if (!disabled && fileInputRef.current && state === "idle") {
      fileInputRef.current.click();
    }
  }, [disabled, state]);

  const resetState = () => {
    setState("idle");
    setErrorMessage("");
    setExtractedData(null);
    setFileName("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const getCardStyles = () => {
    const baseClasses = "transition-all duration-300 border-2";

    switch (state) {
      case "success":
        return `${baseClasses} border-green-400 bg-green-50 shadow-sm`;
      case "error":
        return `${baseClasses} border-red-400 bg-red-50 shadow-sm`;
      case "not-invoice":
        return `${baseClasses} border-orange-400 bg-orange-50 shadow-sm`;
      case "processing":
        return `${baseClasses} border-blue-400 bg-blue-50 shadow-md`;
      default:
        return isDragActive
          ? `${baseClasses} border-blue-500 bg-blue-50 shadow-lg scale-[1.02]`
          : `${baseClasses} border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-gray-400`;
    }
  };

  return (
    <div className="w-full space-y-4">
      <Card className={getCardStyles()}>
        <CardContent className="p-6">
          <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={handleClick}
            className={`flex min-h-[120px] flex-col justify-center text-center ${disabled ? "cursor-not-allowed opacity-50" : state === "idle" ? "cursor-pointer" : ""} `}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileInput}
              accept="image/*,application/pdf,text/plain"
              className="hidden"
              disabled={disabled}
            />

            <div className="flex flex-col items-center space-y-3">
              {state === "processing" && (
                <>
                  <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
                  <div className="space-y-1">
                    <p className="text-lg font-semibold text-blue-900">Analyzing document...</p>
                    {fileName ? <p className="max-w-xs truncate text-xs text-gray-500">{fileName}</p> : null}
                  </div>
                </>
              )}

              {state === "success" && (
                <>
                  <CheckCircle className="h-10 w-10 text-green-600" />
                  <div className="space-y-1">
                    <p className="text-lg font-semibold text-green-800">Invoice processed successfully!</p>
                    <p className="text-sm text-green-600">Your form has been filled automatically</p>
                  </div>
                </>
              )}

              {state === "not-invoice" && (
                <>
                  <FileText className="h-10 w-10 text-orange-500" />
                  <div className="space-y-1">
                    <p className="text-lg font-semibold text-orange-800">Not an invoice document</p>
                    <p className="text-sm text-orange-600">Please upload a billing document instead</p>
                  </div>
                </>
              )}

              {state === "error" && (
                <>
                  <AlertCircle className="h-10 w-10 text-red-500" />
                  <div className="space-y-1">
                    <p className="text-lg font-semibold text-red-700">Processing failed</p>
                    <p className="text-sm text-red-600">Please try again or fill the form manually</p>
                  </div>
                </>
              )}

              {state === "idle" && (
                <>
                  <div className="flex items-center space-x-3">
                    <Upload
                      className={`h-8 w-8 transition-colors ${isDragActive ? "text-blue-500" : "text-gray-400"}`}
                    />
                    <FileText
                      className={`h-8 w-8 transition-colors ${isDragActive ? "text-blue-500" : "text-gray-400"}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <p
                      className={`text-lg font-medium transition-colors ${isDragActive ? "text-blue-700" : "text-gray-700"}`}
                    >
                      {isDragActive ? "Drop your invoice here" : "Upload invoice or receipt"}
                    </p>
                    <p className="text-sm text-gray-500">Drag & drop or click to browse</p>
                    <p className="text-xs text-gray-400">Supports: Images (JPG, PNG, WebP), PDF, Text • Max 10MB</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {(state === "success" || state === "error" || state === "not-invoice") && (
            <div className="mt-6 flex justify-center">
              <Button variant="outline" size="small" onClick={resetState} className="gap-2">
                <X className="h-4 w-4" />
                Try Another Document
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {errorMessage && (state === "error" || state === "not-invoice") ? (
        <Alert variant={state === "not-invoice" ? "default" : "destructive"} className="border-l-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm leading-relaxed">{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {state === "success" && extractedData ? (
        <Alert className="border-l-4 border-l-green-500">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription>
            <div className="space-y-2 text-sm">
              <p className="mb-2 font-medium text-green-800">Successfully extracted:</p>
              <div className="grid gap-1 text-gray-700">
                <p>
                  <span className="font-medium">Service:</span> {extractedData.description}
                </p>
                <p>
                  <span className="font-medium">Amount:</span> ${(extractedData.payRateInSubunits / 100).toFixed(2)}
                  {extractedData.quantity !== "1" && ` × ${extractedData.quantity}`}
                  {extractedData.hourly ? " per hour" : ""}
                </p>
                <p>
                  <span className="font-medium">Date:</span> {extractedData.invoiceDate}
                </p>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
