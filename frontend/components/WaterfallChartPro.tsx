// Professional waterfall chart component with clean, modern design
import React, { useMemo, useState, useEffect } from "react";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import type { PlaygroundPayout } from "@/lib/equity-modeling/types";

interface WaterfallChartProps {
  payouts: PlaygroundPayout[];
  exitAmountCents: bigint;
  className?: string;
  onPayoutHover?: (payout: PlaygroundPayout | null) => void;
  highlightedPayoutId?: string;
  isCalculating?: boolean;
}

const SHARE_CLASS_COLORS = {
  "Common Stock": "#94A3B8", // Slate-400
  "Series Seed": "#34D399", // Emerald-400
  "Series A": "#60A5FA", // Blue-400
  "Series B": "#A78BFA", // Violet-400
  "Series C": "#FBBF24", // Amber-400
  "Series D": "#F87171", // Red-400
  "Series E": "#F472B6", // Pink-400
} as const;

function getShareClassColor(shareClassName: string): string {
  // Check for exact matches first
  if (shareClassName in SHARE_CLASS_COLORS) {
    return SHARE_CLASS_COLORS[shareClassName as keyof typeof SHARE_CLASS_COLORS];
  }

  // Check for partial matches (e.g., "Series A Preferred" matches "Series A")
  for (const [key, color] of Object.entries(SHARE_CLASS_COLORS)) {
    if (shareClassName.includes(key)) {
      return color;
    }
  }

  // Default color
  return "#9CA3AF"; // Gray-400
}

export default function WaterfallChartPro({
  payouts,
  exitAmountCents,
  className = "",
  onPayoutHover,
  highlightedPayoutId,
  isCalculating = false,
}: WaterfallChartProps) {
  // Keep track of the last valid chart data to show while calculating
  const [lastValidChartData, setLastValidChartData] = useState<{
    segments: any[];
    totalPaid: number;
    undistributed: number;
    shareClasses: any[];
    exitAmount: number;
  } | null>(null);

  // Track the exit amount that the current payouts were calculated for
  const [payoutsCalculatedForExitAmount, setPayoutsCalculatedForExitAmount] = useState<string | null>(null);

  // Update the tracked exit amount when payouts change and we're not calculating
  useEffect(() => {
    if (!isCalculating && payouts.length > 0) {
      setPayoutsCalculatedForExitAmount(exitAmountCents.toString());
    }
  }, [payouts, isCalculating]);

  const chartData = useMemo(() => {
    const exitAmount = Number(exitAmountCents);
    
    // Check if payouts are stale (calculated for different exit amount)
    const payoutsStale = payoutsCalculatedForExitAmount !== null && 
      payoutsCalculatedForExitAmount !== exitAmountCents.toString();
    
    // If we're calculating OR payouts are stale, return previous valid data
    if ((isCalculating || payoutsStale) && lastValidChartData) {
      return lastValidChartData;
    }

    const totalPaid = payouts.reduce((sum, p) => sum + Number(p.payoutAmountCents), 0);

    // Group payouts by share class for legend
    const shareClassMap = new Map<string, { color: string; amount: number }>();

    const segments = payouts
      .filter((p) => p.payoutAmountCents > 0)
      .map((payout) => {
        const color = getShareClassColor(payout.shareClassName);
        const percentage = (Number(payout.payoutAmountCents) / exitAmount) * 100;

        // Update share class totals
        const existing = shareClassMap.get(payout.shareClassName) || { color, amount: 0 };
        shareClassMap.set(payout.shareClassName, {
          color,
          amount: existing.amount + Number(payout.payoutAmountCents),
        });

        return {
          payout,
          color,
          percentage,
          amount: Number(payout.payoutAmountCents),
        };
      })
      .sort((a, b) => {
        // Sort by share class priority (Series B first, then A, then Seed, then Common)
        const getPriority = (className: string) => {
          if (className.includes("Series B")) return 0;
          if (className.includes("Series A")) return 1;
          if (className.includes("Seed")) return 2;
          if (className.includes("Common")) return 3;
          return 4;
        };
        return getPriority(a.payout.shareClassName) - getPriority(b.payout.shareClassName);
      });

    const undistributed = Math.max(0, exitAmount - totalPaid);

    const newChartData = {
      segments,
      totalPaid,
      undistributed,
      shareClasses: Array.from(shareClassMap.entries()).map(([name, data]) => ({
        name,
        color: data.color,
        amount: data.amount,
        percentage: (data.amount / exitAmount) * 100,
      })),
      exitAmount,
    };

    // Update last valid data when we have fresh calculations
    if (!isCalculating) {
      setLastValidChartData(newChartData);
    }

    return newChartData;
  }, [payouts, exitAmountCents, isCalculating, payoutsCalculatedForExitAmount]);

  const { segments, totalPaid, undistributed, shareClasses, exitAmount } = chartData;
  
  // Check if payouts are stale for the undistributed box
  const payoutsStale = payoutsCalculatedForExitAmount !== null && 
    payoutsCalculatedForExitAmount !== exitAmountCents.toString();

  if (segments.length === 0) {
    return (
      <div
        className={`${className} flex h-96 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50`}
      >
        <div className="text-center">
          <p className="mb-2 text-gray-500">No distributions at this exit amount</p>
          <p className="text-sm text-gray-400">Increase the exit amount to see payouts</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className} rounded-lg border border-gray-200 bg-white p-6`}>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Liquidation Waterfall</h3>
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900">{formatMoneyFromCents(exitAmount)}</div>
          <div className="text-sm text-gray-500">Exit Amount</div>
        </div>
      </div>

      <div className="flex gap-8">
        {/* Main Chart */}
        <div className="flex-1">
          <div className="relative">
            {/* Waterfall Container */}
            <div className="rounded-lg bg-gray-50 p-4">
              {/* Amount at top */}
              <div className="mb-4 text-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2">
                  <span className="text-sm text-gray-600">Total</span>
                  <span className="text-lg font-semibold text-gray-900">{formatMoneyFromCents(exitAmount)}</span>
                </div>
              </div>

              {/* Waterfall Segments */}
              <div className="space-y-0.5">
                {segments.map((segment, index) => {
                  const heightPercent = segment.percentage;
                  const isHighlighted = highlightedPayoutId === segment.payout.id;

                  return (
                    <div
                      key={segment.payout.id}
                      className={`group relative overflow-hidden rounded transition-all duration-200 ${
                        isHighlighted ? "ring-2 ring-blue-500 ring-offset-2" : ""
                      }`}
                      style={{
                        height: `${Math.max(heightPercent * 3, 30)}px`, // Min height for readability
                        backgroundColor: segment.color,
                      }}
                      onMouseEnter={() => onPayoutHover?.(segment.payout)}
                      onMouseLeave={() => onPayoutHover?.(null)}
                    >
                      {/* Segment Content */}
                      <div className="absolute inset-0 flex items-center px-4">
                        <div className="flex flex-1 items-center justify-between">
                          <span className="truncate pr-2 font-medium text-white">{segment.payout.investorName}</span>
                          <span className="text-sm font-medium whitespace-nowrap text-white">
                            {formatMoneyFromCents(segment.amount)}
                          </span>
                        </div>
                      </div>

                      {/* Hover Tooltip */}
                      <div className="pointer-events-none absolute top-1/2 left-full z-20 ml-4 -translate-y-1/2 rounded-lg bg-gray-900 px-3 py-2 text-sm whitespace-nowrap text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100">
                        <div className="mb-1 font-semibold">{segment.payout.investorName}</div>
                        <div className="mb-2 text-xs text-gray-300">{segment.payout.shareClassName}</div>
                        <div className="space-y-0.5 text-xs">
                          <div>Total: {formatMoneyFromCents(segment.amount)}</div>
                          {segment.payout.liquidationPreferenceAmount > 0 && (
                            <div>Preference: {formatMoneyFromCents(segment.payout.liquidationPreferenceAmount)}</div>
                          )}
                          {segment.payout.participationAmount > 0 && (
                            <div>Participation: {formatMoneyFromCents(segment.payout.participationAmount)}</div>
                          )}
                          {segment.payout.commonProceedsAmount > 0 && (
                            <div>Common: {formatMoneyFromCents(segment.payout.commonProceedsAmount)}</div>
                          )}
                        </div>
                        <div className="absolute top-1/2 right-full mr-1 -translate-y-1/2">
                          <div className="h-0 w-0 border-t-4 border-r-4 border-b-4 border-transparent border-r-gray-900"></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Undistributed Amount - REMOVED to prevent phantom bars */}
              {/* In a proper waterfall, every cent should be allocated to shareholders */}
              
              {/* Show calculating indicator when payouts are being recalculated */}
              {isCalculating && (
                <div className="mt-2">
                  <div className="rounded border-2 border-dashed border-blue-300 bg-blue-50 p-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                      <div className="text-sm font-medium text-blue-600">Calculating...</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="w-64">
          <h4 className="mb-3 text-sm font-semibold text-gray-700">Share Classes</h4>
          <div className="space-y-2">
            {shareClasses.map(({ name, color, amount, percentage }) => (
              <div key={name} className="flex items-center justify-between">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <div className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: color }} />
                  <span className="truncate text-sm text-gray-700">{name}</span>
                </div>
                <div className="ml-2 text-right">
                  <div className="text-sm font-medium text-gray-900">{percentage.toFixed(1)}%</div>
                  <div className="text-xs text-gray-500">{formatMoneyFromCents(amount)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="mt-6 border-t border-gray-200 pt-6">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-gray-900">{formatMoneyFromCents(totalPaid)}</div>
            <div className="text-sm text-gray-500">Total Distributed</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{segments.length}</div>
            <div className="text-sm text-gray-500">Recipients</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{((totalPaid / exitAmount) * 100).toFixed(0)}%</div>
            <div className="text-sm text-gray-500">Distribution Rate</div>
          </div>
        </div>
      </div>
    </div>
  );
}
