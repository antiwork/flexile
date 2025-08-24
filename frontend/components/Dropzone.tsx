"use client";
import CircularProgress from "@/components/CircularProgress";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowUpTrayIcon } from "@heroicons/react/24/outline";
import { useCallback, useRef, useState } from "react";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
interface DropzoneOptions {
  onFileSelected: (file: File) => Promise<void>;
}
interface DropzoneState {
  isDragging: boolean;
  isProcessing: boolean;
}

function getDTFileIfValid(dataTransfer: DataTransfer) {
  const items = Array.from(dataTransfer?.items);
  const item = items[0];
  if (items.length !== 1 || !item || item.kind !== "file" || item.type !== "application/pdf") return;
  return item;
}
function preventDefault(e: React.DragEvent) {
  e.preventDefault();
  e.stopPropagation();
}
export function useDropzone({ onFileSelected }: DropzoneOptions) {
  const [state, setState] = useState<DropzoneState>({
    isDragging: false,
    isProcessing: false,
  });
  const updateState = (update: Partial<DropzoneState>) => {
    setState((state) => ({ ...state, ...update }));
  };
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    preventDefault(e);
    const file = getDTFileIfValid(e.dataTransfer);
    if (!file) return;
    updateState({ isDragging: true });
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    preventDefault(e);
    if (e.currentTarget.contains(e.relatedTarget)) return;
    updateState({ isDragging: false });
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      preventDefault(e);
      const file = getDTFileIfValid(e.dataTransfer)?.getAsFile();
      if (!file || file.size > MAX_FILE_SIZE) return;
      updateState({ isDragging: false, isProcessing: true });
      await onFileSelected(file);
      updateState({ isProcessing: false });
    },
    [onFileSelected],
  );

  const handleInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || file.size > MAX_FILE_SIZE) return;
      updateState({ isProcessing: true });
      await onFileSelected(file);
      updateState({ isProcessing: false });
      e.target.value = "";
    },
    [onFileSelected],
  );

  return {
    openFilePicker: inputRef.current?.click,
    state,
    dragProps: {
      id: "dropzone",
      onDrop: handleDrop,
      onDragEnter: handleDragEnter,
      onDragLeave: handleDragLeave,
      onDragOver: preventDefault,
    },
    inputProps: {
      ref: inputRef,
      type: "file" as const,
      accept: "application/pdf",
      multiple: false,
      onChange: handleInputChange,
      style: { display: "none" },
    },
  };
}

export function Dropzone({ isProcessing, isDragging }: DropzoneState) {
  if (!isProcessing && !isDragging) return null;
  return (
    <Card className="animate-in pointer-events-none fixed inset-0 z-50 flex items-center justify-center overflow-hidden border-none bg-black/10 duration-200">
      <CardContent className="flex flex-col items-center">
        {isProcessing && <CircularProgress progress={100} className="mb-3 h-8 w-8" />}
        {isDragging && <ArrowUpTrayIcon className="mb-3 h-8 w-8" />}
        <div className="text-foreground text-lg font-semibold">
          {isProcessing && "Extracting..."}
          {isDragging && "Drag your PDF here"}
        </div>
        <div className="text-muted-foreground text-sm">
          {isProcessing && "Hang tight, we're reading your PDF..."}
          {isDragging && "Release the file to automatically fill your invoice"}
        </div>
      </CardContent>
    </Card>
  );
}
