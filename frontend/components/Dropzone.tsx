"use client";
import { Card, CardContent } from "@/components/ui/card";
import { useCallback, useState, type PropsWithChildren } from "react";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
interface DropzoneOptions {
  onFileSelected: (file: File) => Promise<void>;
}

export function useDropzone({ onFileSelected }: DropzoneOptions) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    preventDefault(e);
    const file = getFileIfValid(e.dataTransfer);
    if (!file) return;
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    preventDefault(e);
    // If user is dragging over a child element, don't hide the dropzone
    // @ts-expect-error https://stackoverflow.com/a/54271161
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      preventDefault(e);
      const file = getFileIfValid(e.dataTransfer)?.getAsFile();
      if (!file || file.size > MAX_FILE_SIZE) return;
      setIsDragging(false);
      setIsProcessing(true);
      onFileSelected(file).finally(() => setIsProcessing(false));
    },
    [onFileSelected],
  );

  // Allows only one PDF file to be dropped
  const getFileIfValid = useCallback((dataTransfer: DataTransfer) => {
    const items = Array.from(dataTransfer?.items);
    const item = items[0];
    if (items.length !== 1 || !item || item.kind !== "file" || item.type !== "application/pdf") return;
    return item;
  }, []);

  return {
    dragProps: {
      onDrop: handleDrop,
      onDragEnter: handleDragEnter,
      onDragLeave: handleDragLeave,
      onDragOver: preventDefault,
      id: "dropzone",
    },
    isDragging,
    isProcessing,
  };
}

export function DropzoneOverlay({ children }: PropsWithChildren) {
  return (
    <Card className="animate-in pointer-events-none fixed inset-0 z-50 flex items-center justify-center overflow-hidden border-none bg-black/10 duration-200">
      <CardContent className="flex flex-col items-center">{children}</CardContent>
    </Card>
  );
}

function preventDefault(e: React.DragEvent) {
  e.preventDefault();
  e.stopPropagation();
}
