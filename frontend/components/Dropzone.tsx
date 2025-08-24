"use client";
import { ArrowUpTrayIcon } from "@heroicons/react/24/outline";
import { useCallback, useRef, useState } from "react";
import CircularProgress from "@/components/CircularProgress";
import { Card, CardContent } from "@/components/ui/card";

interface DropzoneOptions {
  onFileSelected: (file: File) => Promise<void>;
}
interface DropzoneState {
  isDragging: boolean;
  isProcessing: boolean;
}

function getDTFileIfValid(dataTransfer: DataTransfer) {
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
  const inputRef = useRef<HTMLInputElement>(null);

  const openFilePicker = () => {
    inputRef.current?.click();
  };

  const handleInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setIsProcessing(true);
      await onFileSelected(file);
      setIsProcessing(false);
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
    const file = getDTFileIfValid(e.dataTransfer);
    if (!file) return;
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    preventDefault(e);
    if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) return;
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      preventDefault(e);
      const file = getDTFileIfValid(e.dataTransfer)?.getAsFile();
      if (!file) return;
      setIsDragging(false);
      setIsProcessing(true);
      await onFileSelected(file);
      setIsProcessing(false);
    },
    [onFileSelected],
  );

  return {
    openFilePicker,
    state: {
      isDragging,
      isProcessing,
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
    <Card className="animate-in pointer-events-none fixed inset-0 z-50 flex items-center justify-center overflow-hidden border-none bg-black/10 duration-200">
      <CardContent className="flex flex-col items-center">
        {isProcessing ? <CircularProgress progress={100} className="mb-3 h-8 w-8" /> : null}
        {isDragging ? <ArrowUpTrayIcon className="mb-3 h-8 w-8" /> : null}
        <div className="text-foreground text-lg font-semibold">
          {isProcessing ? "Extracting..." : null}
          {isDragging ? "Drag your PDF here" : null}
        </div>
        <div className="text-muted-foreground text-sm">
          {isProcessing ? "Hang tight, we're reading your PDF..." : null}
          {isDragging ? "Release the file to automatically fill your invoice" : null}
        </div>
      </CardContent>
    </Card>
  );
}
