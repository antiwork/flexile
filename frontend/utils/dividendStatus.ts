import type { RouterOutput } from "@/trpc";

type Dividend = RouterOutput["dividends"]["list"][number];

// Define status configuration type
export type StatusKey = "pending" | "ready" | "processing" | "completed" | "failed" | "retained";

// Map backend status values to frontend status values
export const normalizeStatus = (backendStatus: Dividend["status"]): StatusKey => {
  const statusMap: Record<Dividend["status"], StatusKey> = {
    "Pending signup": "pending",
    Issued: "ready",
    Processing: "processing",
    Paid: "completed",
    Retained: "retained",
  };
  return statusMap[backendStatus] || "pending";
};

// Status configuration for payment badges
export const STATUS_BADGE_MAP = {
  pending: {
    color: "yellow",
    label: "Pending Setup",
    className: "border-yellow-200 text-yellow-700 bg-yellow-50",
  },
  ready: {
    color: "blue",
    label: "Ready to Pay",
    className: "border-blue-200 text-blue-700 bg-blue-50",
  },
  processing: {
    color: "orange",
    label: "Processing",
    className: "border-orange-200 text-orange-700 bg-orange-50",
  },
  completed: {
    color: "green",
    label: "Completed",
    className: "border-green-200 text-green-700 bg-green-50",
  },
  failed: {
    color: "red",
    label: "Failed",
    className: "border-red-200 text-red-700 bg-red-50",
  },
  retained: {
    color: "gray",
    label: "Retained (Below Threshold)",
    className: "border-gray-200 text-gray-700 bg-gray-50",
  },
} as const;
