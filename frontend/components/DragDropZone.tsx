import React, { useCallback, useState } from "react";
import { Upload, X } from "lucide-react";
import { cn } from "@/utils";

interface DragDropZoneProps {
  onFileSelect: (file: File) => void;
  acceptedFileTypes?: string[];
  maxFileSize?: number; // in bytes
  className?: string;
  disabled?: boolean;
  loading?: boolean;
}

export function DragDropZone({
  onFileSelect,
  acceptedFileTypes = ["application/pdf"],
  maxFileSize = 10 * 1024 * 1024, // 10MB default
  className,
  disabled = false,
  loading = false,
}: DragDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFile = useCallback((file: File): string | null => {
    if (!acceptedFileTypes.includes(file.type)) {
      return `File type ${file.type} is not supported. Please upload a PDF file.`;
    }

    if (file.size > maxFileSize) {
      return `File size ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds the maximum allowed size of ${(maxFileSize / 1024 / 1024).toFixed(1)}MB.`;
    }

    return null;
  }, [acceptedFileTypes, maxFileSize]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    setError(null);

    if (disabled || loading) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const file = files[0];
    const validationError = validateFile(file);

    if (validationError) {
      setError(validationError);
      return;
    }

    onFileSelect(file);
  }, [disabled, loading, validateFile, onFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled && !loading) {
      setIsDragOver(true);
    }
  }, [disabled, loading]);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const file = files[0];
    const validationError = validateFile(file);

    if (validationError) {
      setError(validationError);
      return;
    }

    onFileSelect(file);
    // Reset input
    e.target.value = "";
  }, [validateFile, onFileSelect]);

  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn(
          "relative border-2 border-dashed rounded-lg p-6 text-center transition-colors",
          isDragOver && !disabled && !loading
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 hover:border-gray-400",
          disabled && "opacity-50 cursor-not-allowed",
          loading && "opacity-75 cursor-wait"
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {loading ? (
          <div className="flex flex-col items-center space-y-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-sm text-gray-600">Processing PDF...</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center space-y-2">
              <Upload className="h-8 w-8 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Drop your invoice PDF here
                </p>
                <p className="text-xs text-gray-500">
                  or click to browse files
                </p>
              </div>
            </div>

            <input
              type="file"
              accept={acceptedFileTypes.join(",")}
              onChange={handleFileInput}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={disabled || loading}
            />
          </>
        )}
      </div>

      {error && (
        <div className="mt-2 flex items-center space-x-2 text-sm text-red-600">
          <X className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-2 text-xs text-gray-500">
        Supported: PDF files up to {(maxFileSize / 1024 / 1024).toFixed(1)}MB
      </div>
    </div>
  );
}
