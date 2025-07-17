// Professional waterfall chart component with clean, modern design
import React, { useMemo } from 'react';
import { formatMoneyFromCents } from '@/utils/formatMoney';
import type { PlaygroundPayout } from '@/lib/equity-modeling/types';

interface WaterfallChartProps {
  payouts: PlaygroundPayout[];
  exitAmountCents: bigint;
  className?: string;
  onPayoutHover?: (payout: PlaygroundPayout | null) => void;
  highlightedPayoutId?: string;
}

const SHARE_CLASS_COLORS = {
  'Common Stock': '#94A3B8', // Slate-400
  'Series Seed': '#34D399', // Emerald-400
  'Series A': '#60A5FA', // Blue-400
  'Series B': '#A78BFA', // Violet-400
  'Series C': '#FBBF24', // Amber-400
  'Series D': '#F87171', // Red-400
  'Series E': '#F472B6', // Pink-400
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
  return '#9CA3AF'; // Gray-400
}

export default function WaterfallChartPro({
  payouts,
  exitAmountCents,
  className = '',
  onPayoutHover,
  highlightedPayoutId,
}: WaterfallChartProps) {
  
  const chartData = useMemo(() => {
    const totalPaid = payouts.reduce((sum, p) => sum + Number(p.payoutAmountCents), 0);
    const exitAmount = Number(exitAmountCents);
    const undistributed = Math.max(0, exitAmount - totalPaid);
    
    // Group payouts by share class for legend
    const shareClassMap = new Map<string, { color: string; amount: number }>();
    
    const segments = payouts
      .filter(p => p.payoutAmountCents > 0)
      .map(payout => {
        const color = getShareClassColor(payout.shareClassName);
        const percentage = (Number(payout.payoutAmountCents) / exitAmount) * 100;
        
        // Update share class totals
        const existing = shareClassMap.get(payout.shareClassName) || { color, amount: 0 };
        shareClassMap.set(payout.shareClassName, {
          color,
          amount: existing.amount + Number(payout.payoutAmountCents)
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
          if (className.includes('Series B')) return 0;
          if (className.includes('Series A')) return 1;
          if (className.includes('Seed')) return 2;
          if (className.includes('Common')) return 3;
          return 4;
        };
        return getPriority(a.payout.shareClassName) - getPriority(b.payout.shareClassName);
      });
    
    return {
      segments,
      totalPaid,
      undistributed,
      shareClasses: Array.from(shareClassMap.entries()).map(([name, data]) => ({
        name,
        color: data.color,
        amount: data.amount,
        percentage: (data.amount / exitAmount) * 100,
      })),
    };
  }, [payouts, exitAmountCents]);

  const { segments, totalPaid, undistributed, shareClasses } = chartData;
  const exitAmount = Number(exitAmountCents);

  if (segments.length === 0) {
    return (
      <div className={`${className} flex items-center justify-center h-96 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300`}>
        <div className="text-center">
          <p className="text-gray-500 mb-2">No distributions at this exit amount</p>
          <p className="text-sm text-gray-400">Increase the exit amount to see payouts</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className} bg-white rounded-lg border border-gray-200 p-6`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
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
            <div className="bg-gray-50 rounded-lg p-4">
              {/* Amount at top */}
              <div className="text-center mb-4">
                <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-gray-200">
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
                      className={`relative group transition-all duration-200 rounded overflow-hidden ${
                        isHighlighted ? 'ring-2 ring-blue-500 ring-offset-2' : ''
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
                        <div className="flex-1 flex items-center justify-between">
                          <span className="text-white font-medium truncate pr-2">
                            {segment.payout.investorName}
                          </span>
                          <span className="text-white text-sm font-medium whitespace-nowrap">
                            {formatMoneyFromCents(segment.amount)}
                          </span>
                        </div>
                      </div>

                      {/* Hover Tooltip */}
                      <div className="absolute left-full ml-4 top-1/2 -translate-y-1/2 bg-gray-900 text-white px-3 py-2 rounded-lg text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-20 shadow-lg">
                        <div className="font-semibold mb-1">{segment.payout.investorName}</div>
                        <div className="text-gray-300 text-xs mb-2">{segment.payout.shareClassName}</div>
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
                        <div className="absolute right-full top-1/2 -translate-y-1/2 mr-1">
                          <div className="w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-gray-900"></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Undistributed Amount */}
              {undistributed > 0 && (
                <div className="mt-2">
                  <div className="bg-gray-200 border-2 border-dashed border-gray-300 rounded p-3 text-center">
                    <div className="text-sm font-medium text-gray-600">Undistributed</div>
                    <div className="text-gray-700 font-semibold">{formatMoneyFromCents(undistributed)}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="w-64">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Share Classes</h4>
          <div className="space-y-2">
            {shareClasses.map(({ name, color, amount, percentage }) => (
              <div key={name} className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div 
                    className="w-3 h-3 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-sm text-gray-700 truncate">{name}</span>
                </div>
                <div className="text-right ml-2">
                  <div className="text-sm font-medium text-gray-900">{percentage.toFixed(1)}%</div>
                  <div className="text-xs text-gray-500">{formatMoneyFromCents(amount)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="mt-6 pt-6 border-t border-gray-200">
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
            <div className="text-2xl font-bold text-gray-900">
              {((totalPaid / exitAmount) * 100).toFixed(0)}%
            </div>
            <div className="text-sm text-gray-500">Distribution Rate</div>
          </div>
        </div>
      </div>
    </div>
  );
}