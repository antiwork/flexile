import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { PDF_MAX_FILE_SIZE, PDF_MAX_FILE_SIZE_MB } from "@/models/constants";

const parsedInvoiceSchema = z.object({
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

export type ParsedInvoiceData = z.infer<typeof parsedInvoiceSchema>;

export function usePdfDragAndDrop({ onPdfParsed }: { onPdfParsed: (data: ParsedInvoiceData, file: File) => void }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragCounter = useRef(0);

  const processPdfFile = useCallback(
    async (pdfFile: File) => {
      setError(null);

      if (pdfFile.type !== "application/pdf") {
        setError("Please select a PDF file");
        return;
      }

      if (pdfFile.size > PDF_MAX_FILE_SIZE) {
        setError(`File size exceeds ${PDF_MAX_FILE_SIZE_MB}MB limit. Please upload a smaller PDF.`);
        return;
      }

      setIsParsing(true);
      try {
        const formData = new FormData();
        formData.append("file", pdfFile);

        const response = await fetch("/api/invoices/parse-pdf", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          let errorData: { error: string };
          try {
            const jsonResult: unknown = await response.json();
            if (
              typeof jsonResult === "object" &&
              jsonResult !== null &&
              "error" in jsonResult &&
              typeof jsonResult.error === "string"
            ) {
              errorData = { error: jsonResult.error };
            } else {
              errorData = { error: "Failed to parse PDF" };
            }
          } catch {
            errorData = { error: "Failed to parse PDF" };
          }
          throw new Error(errorData.error);
        }

        const data = parsedInvoiceSchema.parse(await response.json());
        onPdfParsed(data, pdfFile);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to parse PDF");
      } finally {
        setIsParsing(false);
      }
    },
    [onPdfParsed],
  );

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      setIsDragging(false);
      dragCounter.current = 0;

      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length === 0) {
        setError("Please drop a PDF file");
        return;
      }

      const pdfFile = files.find((f) => f.type === "application/pdf");
      if (!pdfFile) {
        setError("Please drop a PDF file");
        return;
      }

      void processPdfFile(pdfFile);
    },
    [processPdfFile],
  );

  const handleFileSelect = useCallback(
    (file: File) => {
      void processPdfFile(file);
    },
    [processPdfFile],
  );

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    if (e.dataTransfer?.types.includes("Files")) setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    if (--dragCounter.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => e.preventDefault(), []);

  useEffect(() => {
    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleDrop);
    };
  }, [handleDragEnter, handleDragLeave, handleDragOver, handleDrop]);

  return { isDragging, isParsing, error, setError, handleFileSelect };
}
