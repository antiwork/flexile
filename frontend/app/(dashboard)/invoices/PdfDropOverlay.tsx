import { DocumentArrowUpIcon } from "@heroicons/react/24/outline";
import { Loader2 } from "lucide-react";
import React from "react";
import { cn } from "@/utils";

interface PdfDropOverlayProps {
  isDragging: boolean;
  isParsing: boolean;
}

export function PdfDropOverlay({ isDragging, isParsing }: PdfDropOverlayProps) {
  const isVisible = isDragging || isParsing;

  if (!isVisible) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      <div
        className={cn(
          "absolute inset-0 transition-colors duration-200",
          isDragging && "bg-black/80",
          isParsing && "bg-black/90",
        )}
      />
      <div className="relative flex h-full items-center justify-center p-8">
        <div className="space-y-6 text-center">
          {isDragging && !isParsing ? (
            <>
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/10">
                <DocumentArrowUpIcon className="h-10 w-10 text-white" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-semibold text-white">Drop your invoice PDF here</h3>
                <p className="mx-auto max-w-md text-base text-gray-300">
                  We'll use AI to automatically extract and fill in the invoice details
                </p>
              </div>
            </>
          ) : null}
          {isParsing ? (
            <>
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/10">
                <Loader2 className="h-10 w-10 animate-spin text-white" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-semibold text-white">Parsing your invoice...</h3>
                <p className="text-base text-gray-300">Using AI to extract invoice details from your PDF</p>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
