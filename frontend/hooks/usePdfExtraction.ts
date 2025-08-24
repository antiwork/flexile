import React, { useRef, useState } from "react";

interface LineItem {
  description: string;
  quantity: string;
  hourly: boolean;
  pay_rate_in_subunits: number;
  errors: string[];
}

interface ExtractedData {
  invoice_number?: string;
  invoice_date?: string;
  line_items?: { description?: string; quantity?: number; rate?: number }[];
}

interface ApiResponse {
  success: boolean;
  error?: string;
  data?: ExtractedData;
}

interface UsePdfExtractionProps {
  onExtractedData: (data: { invoiceNumber?: string; invoiceDate?: string; lineItems?: LineItem[] }) => void;
}

const isApiResponse = (data: unknown): data is ApiResponse => {
  if (typeof data !== "object" || data === null || !("success" in data)) {
    return false;
  }
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return typeof (data as { success: unknown }).success === "boolean";
};

export const usePdfExtraction = ({ onExtractedData }: UsePdfExtractionProps) => {
  const [isExtracting, setIsExtracting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showError = (message: string) => {
    // eslint-disable-next-line no-console
    console.error("PDF extraction error:", message);
    setError(message);
  };

  const processFile = async (file: File) => {
    if (file.type !== "application/pdf") return;

    setIsExtracting(true);
    setError(null);
    const formData = new FormData();
    formData.append("pdf", file);

    try {
      const response = await fetch("/api/invoices/extract-data", {
        method: "POST",
        body: formData,
      });

      let result: ApiResponse;
      try {
        const responseData: unknown = await response.json();
        if (!isApiResponse(responseData)) {
          showError("Invalid response format from server");
          return;
        }
        result = responseData;
      } catch {
        showError("Failed to process server response");
        return;
      }

      if (!result.success) {
        const errorMsg = result.error ?? "Failed to extract invoice data";
        showError(errorMsg);
        return;
      }

      if (result.data) {
        const extracted = result.data;

        onExtractedData({
          ...(extracted.invoice_number && { invoiceNumber: extracted.invoice_number }),
          ...(extracted.invoice_date && { invoiceDate: extracted.invoice_date }),
          ...(extracted.line_items && {
            lineItems: extracted.line_items.map((item) => ({
              description: item.description ?? "",
              quantity: item.quantity?.toString() ?? "1",
              hourly: false,
              pay_rate_in_subunits: (item.rate ?? 0) * 100,
              errors: [],
            })),
          }),
        });
      }
    } catch {
      showError("Network error during extraction");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void processFile(file);
    }
  };

  React.useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      const items = Array.from(e.dataTransfer?.items || []);
      const hasPdf = items.some((item) => item.type === "application/pdf");
      if (hasPdf) {
        setIsDragOver(true);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      if (e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
        setIsDragOver(false);
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const files = Array.from(e.dataTransfer?.files || []);
      const pdfFile = files.find((file) => file.type === "application/pdf");
      if (pdfFile) {
        void processFile(pdfFile);
      }
    };

    document.addEventListener("dragenter", handleDragEnter);
    document.addEventListener("dragover", handleDragOver);
    document.addEventListener("dragleave", handleDragLeave);
    document.addEventListener("drop", handleDrop);

    return () => {
      document.removeEventListener("dragenter", handleDragEnter);
      document.removeEventListener("dragover", handleDragOver);
      document.removeEventListener("dragleave", handleDragLeave);
      document.removeEventListener("drop", handleDrop);
    };
  }, [processFile]);

  return {
    isExtracting,
    isDragOver,
    fileInputRef,
    handleFileUpload,
    error,
    clearError: () => setError(null),
  };
};
