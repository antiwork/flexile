"use client";
import { ArrowUpTrayIcon } from "@heroicons/react/24/outline";
import { useCallback, useRef, useState } from "react";
import CircularProgress from "@/components/CircularProgress";
import { Card, CardContent } from "@/components/ui/card";

interface DropzoneOptions {
  onFileSelected: (file: File) => Promise<void>;
}
interface DropzoneState {
  error: Error | null;
  isDragging: boolean;
  isProcessing: boolean;
}

function getDataTransferFileIfValid(dataTransfer: DataTransfer) {
  const items = Array.from(dataTransfer.items);
  const item = items[0];
  if (items.length !== 1 || !item || item.kind !== "file" || item.type !== "application/pdf") return;
  return item;
}
function preventDefault(e: React.DragEvent) {
  e.preventDefault();
  e.stopPropagation();
}
export function useDropzone({ onFileSelected }: DropzoneOptions) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const openFilePicker = () => {
    inputRef.current?.click();
  };

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setIsProcessing(true);
      onFileSelected(file)
        .catch(setError)
        .finally(() => setIsProcessing(false));
      e.target.value = "";
    },
    [onFileSelected],
  );

  const inputProps = {
    ref: inputRef,
    type: "file" as const,
    accept: "application/pdf",
    multiple: false,
    onChange: handleInputChange,
    style: { display: "none" },
  };

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    preventDefault(e);
    const file = getDataTransferFileIfValid(e.dataTransfer);
    if (!file) return;
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    preventDefault(e);
    if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) return;
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      preventDefault(e);
      const file = getDataTransferFileIfValid(e.dataTransfer)?.getAsFile();
      if (!file) return;
      setIsDragging(false);
      setIsProcessing(true);
      onFileSelected(file)
        .catch(setError)
        .finally(() => setIsProcessing(false));
    },
    [onFileSelected],
  );

  return {
    openFilePicker,
    state: {
      isDragging,
      isProcessing,
      error,
    },
    dragProps: {
      id: "dropzone",
      onDrop: handleDrop,
      onDragEnter: handleDragEnter,
      onDragLeave: handleDragLeave,
      onDragOver: preventDefault,
    },
    inputProps,
  };
}

export function Dropzone({ isProcessing, isDragging }: DropzoneState) {
  if (!isProcessing && !isDragging) return null;

  return (
    <div className="animate-in pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-white/5 backdrop-blur-[1px] duration-200">
      <Card className="border-blue-600/20 bg-blue-50/80 shadow-lg backdrop-blur-sm">
        <CardContent className="flex flex-col items-center p-8">
          {isProcessing ? (
            <CircularProgress progress={60} className="mb-4 h-10 w-10 animate-spin text-blue-600" />
          ) : (
            <ArrowUpTrayIcon className="mb-4 h-10 w-10 text-blue-600" />
          )}
          <div className="text-foreground mb-2 text-lg font-semibold">
            {isProcessing ? "Extracting invoice..." : "Release to import"}
          </div>
          <div className="text-muted-foreground max-w-xs text-center text-sm">
            {isProcessing ? "This may take a few seconds..." : "We'll extract the details automatically."}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
