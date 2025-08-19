import { ArrowUpTrayIcon } from "@heroicons/react/24/outline";

interface PdfDropOverlayProps {
  isDragOver: boolean;
  isExtracting: boolean;
}

const Spinner = () => (
  <div className="border-muted mx-auto mb-4 size-8 animate-spin rounded-full border-4 border-t-blue-600" />
);

export const PdfDropOverlay = ({ isDragOver, isExtracting }: PdfDropOverlayProps) => {
  if (!isDragOver && !isExtracting) return null;

  const isDragState = isDragOver && !isExtracting;
  const isExtractingState = isExtracting;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-sm">
      <div className="rounded-lg border-2 border-dashed border-blue-400 bg-white p-6 shadow-lg">
        {isDragState ? (
          <>
            <ArrowUpTrayIcon className="mx-auto mb-2 size-8 text-blue-600" />
            <div className="text-lg font-semibold text-blue-600">Drop PDF here to auto-fill invoice</div>
            <div className="text-sm text-blue-500">Release to import invoice data</div>
          </>
        ) : null}
        {isExtractingState ? (
          <>
            <Spinner />
            <div className="text-lg font-semibold text-blue-600">Extracting invoice data</div>
            <div className="text-sm text-blue-500">This may take a few seconds...</div>
          </>
        ) : null}
      </div>
    </div>
  );
};
