// Interactive exit amount control with slider and quick preset buttons

import React, { useState, useCallback, useEffect } from 'react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatMoneyFromCents } from '@/utils/formatMoney';

interface ExitAmountControlProps {
  exitAmountCents: bigint;
  onExitAmountChange: (exitAmountCents: bigint) => void;
  className?: string;
  maxAmount?: number; // Maximum for slider in dollars
  disabled?: boolean;
}

const PRESET_MULTIPLIERS = [5, 10, 50, 100, 500]; // Will create $500K, $1M, $5M, $10M, $50M

function formatDollars(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1_000_000_000) {
    return `$${(dollars / 1_000_000_000).toFixed(1)}B`;
  } else if (dollars >= 1_000_000) {
    return `$${(dollars / 1_000_000).toFixed(1)}M`;
  } else if (dollars >= 1_000) {
    return `$${(dollars / 1_000).toFixed(0)}K`;
  } else {
    return `$${dollars.toFixed(0)}`;
  }
}

function parseDollarInput(input: string): number {
  // Remove currency symbols and normalize
  const cleaned = input.replace(/[$,\s]/g, '').toLowerCase();
  
  let multiplier = 1;
  if (cleaned.endsWith('k')) {
    multiplier = 1_000;
  } else if (cleaned.endsWith('m')) {
    multiplier = 1_000_000;
  } else if (cleaned.endsWith('b')) {
    multiplier = 1_000_000_000;
  }
  
  const number = parseFloat(cleaned.replace(/[kmb]$/, ''));
  return isNaN(number) ? 0 : number * multiplier;
}

export default function ExitAmountControl({
  exitAmountCents,
  onExitAmountChange,
  className = '',
  maxAmount = 100_000_000, // $100M default max
  disabled = false,
}: ExitAmountControlProps) {
  const [inputValue, setInputValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  
  const currentDollars = Number(exitAmountCents) / 100;
  const maxAmountCents = maxAmount * 100;

  // Update input value when external value changes (unless user is editing)
  useEffect(() => {
    if (!isEditing) {
      setInputValue(formatMoneyFromCents(Number(exitAmountCents)));
    }
  }, [exitAmountCents, isEditing]);

  const handleSliderChange = useCallback((values: number[]) => {
    const newAmountCents = BigInt(values[0]);
    onExitAmountChange(newAmountCents);
  }, [onExitAmountChange]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  }, []);

  const handleInputFocus = useCallback(() => {
    setIsEditing(true);
    // Show raw number when editing
    setInputValue((Number(exitAmountCents) / 100).toString());
  }, [exitAmountCents]);

  const handleInputBlur = useCallback(() => {
    setIsEditing(false);
    const parsedDollars = parseDollarInput(inputValue);
    const newAmountCents = BigInt(Math.round(parsedDollars * 100));
    onExitAmountChange(newAmountCents);
  }, [inputValue, onExitAmountChange]);

  const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  }, []);

  const handlePresetClick = useCallback((multiplier: number) => {
    const baseAmount = 100_000; // $1K base
    const newAmountCents = BigInt(baseAmount * 100 * multiplier); // Convert to cents
    onExitAmountChange(newAmountCents);
  }, [onExitAmountChange]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Exit Amount</h3>
        <div className="text-sm text-gray-600">
          Adjust to see real-time waterfall changes
        </div>
      </div>

      {/* Direct input */}
      <div className="space-y-2">
        <label htmlFor="exit-amount" className="block text-sm font-medium text-gray-700">
          Exit Amount
        </label>
        <Input
          id="exit-amount"
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          disabled={disabled}
          placeholder="$10,000,000"
          className="text-lg font-medium"
        />
        <div className="text-xs text-gray-500">
          Enter amount like: 10M, 50000000, or $25,000,000
        </div>
      </div>

      {/* Slider */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>$0</span>
          <span className="font-medium">{formatDollars(Number(exitAmountCents))}</span>
          <span>{formatDollars(maxAmountCents)}</span>
        </div>
        
        <Slider
          value={[Math.min(Number(exitAmountCents), maxAmountCents)]}
          onValueChange={handleSliderChange}
          max={maxAmountCents}
          min={0}
          step={100_000} // $1K steps in cents
          disabled={disabled}
          className="w-full"
        />
      </div>

      {/* Preset buttons */}
      <div className="space-y-2">
        <div className="text-sm font-medium text-gray-700">Quick Scenarios</div>
        <div className="flex gap-2 flex-wrap">
          {PRESET_MULTIPLIERS.map(multiplier => {
            const amount = 100_000 * multiplier; // Base $1K
            const isActive = Math.abs(currentDollars - amount) < 1000; // Within $1K tolerance
            
            return (
              <Button
                key={multiplier}
                variant={isActive ? "default" : "outline"}
                size="small"
                onClick={() => handlePresetClick(multiplier)}
                disabled={disabled}
                className="text-xs"
              >
                {formatDollars(amount * 100)}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Analysis hints */}
      <div className="text-xs text-gray-500 space-y-1">
        <div>💡 <strong>Low exits:</strong> See liquidation preferences in action</div>
        <div>💡 <strong>High exits:</strong> See participation rights kick in</div>
      </div>
    </div>
  );
}