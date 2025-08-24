import { ArrowUpTrayIcon } from "@heroicons/react/24/outline";

interface PdfDropZoneProps {
  isDragOver: boolean;
  isExtracting: boolean;
  onFileSelect: () => void;
  disabled?: boolean;
}

export const PdfDropZone = ({ isDragOver, isExtracting, onFileSelect, disabled }: PdfDropZoneProps) => (
  <div className="mx-4 mt-6 mb-4">
    <div
      className={`relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-all duration-200 ${
        isDragOver
          ? "scale-[1.02] border-blue-500 bg-blue-50 shadow-lg"
          : isExtracting
            ? "cursor-wait border-blue-400 bg-blue-50"
            : disabled
              ? "cursor-not-allowed border-gray-200 bg-gray-50 opacity-50"
              : "border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/50"
      }`}
      onClick={() => !isExtracting && !disabled && onFileSelect()}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !isExtracting && !disabled) {
          onFileSelect();
        }
      }}
      aria-label="Drop invoice PDF here to auto-fill the form"
      aria-busy={isExtracting}
      aria-disabled={disabled}
    >
      {isExtracting ? (
        <>
          <div className="mb-2 size-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
          <p className="text-sm font-medium text-blue-600">Extracting invoice data...</p>
          <p className="mt-1 text-xs text-blue-500">This may take a few seconds</p>
        </>
      ) : isDragOver ? (
        <>
          <ArrowUpTrayIcon className="mb-2 size-10 animate-bounce text-blue-500" />
          <p className="text-sm font-medium text-blue-600">Release to import invoice</p>
          <p className="mt-1 text-xs text-blue-500">We'll extract the details automatically</p>
        </>
      ) : (
        <>
          <ArrowUpTrayIcon className="mb-2 size-10 text-gray-400" />
          <p className="text-sm font-medium text-gray-700">Drop invoice PDF here to auto-fill</p>
          <p className="mt-1 text-xs text-gray-500">or click to select a file</p>
        </>
      )}
    </div>
  </div>
);
