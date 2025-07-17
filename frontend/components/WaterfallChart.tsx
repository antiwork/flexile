// Interactive waterfall chart component for liquidation scenarios
// Uses pure CSS and SVG for high performance

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

interface ChartSegment {
  payout: PlaygroundPayout;
  startY: number;
  height: number;
  color: string;
  percentage: number;
}

const SHARE_CLASS_COLORS = {
  'Common Stock': '#6B7280', // Gray
  'Series Seed': '#10B981', // Emerald
  'Series A': '#3B82F6', // Blue  
  'Series B': '#8B5CF6', // Purple
  'Series C': '#F59E0B', // Amber
  'Series D': '#EF4444', // Red
  'Series E': '#EC4899', // Pink
} as const;

function getShareClassColor(shareClassName: string): string {
  // Check for exact matches first
  if (shareClassName in SHARE_CLASS_COLORS) {
    return SHARE_CLASS_COLORS[shareClassName as keyof typeof SHARE_CLASS_COLORS];
  }
  
  // Check for partial matches
  for (const [key, color] of Object.entries(SHARE_CLASS_COLORS)) {
    if (shareClassName.toLowerCase().includes(key.toLowerCase().replace(' ', ''))) {
      return color;
    }
  }
  
  // Default color for unknown share classes
  const hash = shareClassName.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 55%)`;
}

export default function WaterfallChart({
  payouts,
  exitAmountCents,
  className = '',
  onPayoutHover,
  highlightedPayoutId,
}: WaterfallChartProps) {
  const chartData = useMemo(() => {
    if (payouts.length === 0) {
      return { segments: [], totalHeight: 400 };
    }

    const totalAmount = Number(exitAmountCents);
    const chartHeight = 400;
    let currentY = 0;
    
    const segments: ChartSegment[] = payouts.map(payout => {
      const percentage = totalAmount > 0 ? (payout.payoutAmountCents / totalAmount) * 100 : 0;
      const height = Math.max(8, (payout.payoutAmountCents / totalAmount) * chartHeight);
      
      const segment: ChartSegment = {
        payout,
        startY: currentY,
        height,
        color: getShareClassColor(payout.shareClassName),
        percentage,
      };
      
      currentY += height;
      return segment;
    });

    return { segments, totalHeight: Math.max(chartHeight, currentY) };
  }, [payouts, exitAmountCents]);

  const totalDistributed = payouts.reduce((sum, p) => sum + p.payoutAmountCents, 0);
  const undistributed = Number(exitAmountCents) - totalDistributed;

  if (payouts.length === 0) {
    return (
      <div className={`flex items-center justify-center h-96 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg ${className}`}>
        <div className="text-center">
          <div className="text-lg font-medium">No Payouts</div>
          <div className="text-sm">Adjust exit amount or add investors to see waterfall</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border ${className}`}>
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Liquidation Waterfall</h3>
          <div className="text-sm text-gray-600">
            Exit Amount: {formatMoneyFromCents(Number(exitAmountCents))}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="p-6">
        <div className="flex gap-6">
          {/* Waterfall visualization */}
          <div className="flex-1">
            <div className="relative">
              {/* Flow indicator */}
              <div className="absolute left-1/2 top-0 w-px bg-gray-300 transform -translate-x-1/2" 
                   style={{ height: chartData.totalHeight + 20 }}>
                {/* Arrow at top */}
                <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                  <div className="w-0 h-0 border-l-2 border-r-2 border-b-4 border-transparent border-b-gray-400"></div>
                </div>
              </div>

              {/* Exit amount label */}
              <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 text-sm font-medium text-gray-700">
                {formatMoneyFromCents(Number(exitAmountCents))}
              </div>

              {/* Waterfall segments */}
              <div className="flex flex-col ml-8 mr-8">
                {chartData.segments.map((segment, index) => (
                  <div
                    key={segment.payout.id}
                    className={`relative group cursor-pointer transition-all duration-200 ${
                      highlightedPayoutId === segment.payout.id 
                        ? 'ring-2 ring-blue-500 ring-offset-2 z-10' 
                        : 'hover:ring-2 hover:ring-gray-300 hover:ring-offset-1'
                    }`}
                    style={{
                      height: `${segment.height}px`,
                      backgroundColor: segment.color,
                      marginBottom: index < chartData.segments.length - 1 ? '2px' : '0',
                    }}
                    onMouseEnter={() => onPayoutHover?.(segment.payout)}
                    onMouseLeave={() => onPayoutHover?.(null)}
                  >
                    {/* Segment content */}
                    <div className="absolute inset-0 flex items-center justify-between px-3 text-white text-sm font-medium">
                      <span className="truncate">{segment.payout.investorName}</span>
                      <span>{segment.percentage.toFixed(1)}%</span>
                    </div>

                    {/* Tooltip */}
                    <div className="absolute left-full ml-4 top-1/2 transform -translate-y-1/2 bg-gray-900 text-white px-3 py-2 rounded-lg text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-20">
                      <div className="font-medium">{segment.payout.investorName}</div>
                      <div className="text-gray-300">{segment.payout.shareClassName}</div>
                      <div className="mt-1">
                        <div>Total: {formatMoneyFromCents(segment.payout.payoutAmountCents)}</div>
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
                      <div className="absolute left-0 top-1/2 transform -translate-x-1 -translate-y-1/2">
                        <div className="w-0 h-0 border-t-2 border-b-2 border-r-4 border-transparent border-r-gray-900"></div>
                      </div>
                    </div>

                    {/* Flow arrow */}
                    {index < chartData.segments.length - 1 && (
                      <div className="absolute left-1/2 -bottom-2 transform -translate-x-1/2">
                        <div className="w-0 h-0 border-l-1 border-r-1 border-t-2 border-transparent border-t-gray-400"></div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Undistributed amount indicator */}
                {undistributed > 0 && (
                  <div className="mt-4 p-3 bg-gray-100 border-2 border-dashed border-gray-300 rounded text-center text-gray-600">
                    <div className="text-sm font-medium">Undistributed</div>
                    <div className="text-xs">{formatMoneyFromCents(undistributed)}</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="w-48 space-y-2">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Share Classes</h4>
            {Array.from(new Set(payouts.map(p => p.shareClassName))).map(shareClassName => (
              <div key={shareClassName} className="flex items-center gap-2 text-sm">
                <div 
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: getShareClassColor(shareClassName) }}
                />
                <span>{shareClassName}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Summary stats */}
        <div className="mt-6 pt-4 border-t grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {formatMoneyFromCents(totalDistributed)}
            </div>
            <div className="text-sm text-gray-600">Total Distributed</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {payouts.length}
            </div>
            <div className="text-sm text-gray-600">Recipients</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {((totalDistributed / Number(exitAmountCents)) * 100).toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600">Distribution Rate</div>
          </div>
        </div>
      </div>
    </div>
  );
}