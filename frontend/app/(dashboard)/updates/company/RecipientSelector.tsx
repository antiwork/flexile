"use client";

import { ChevronDown, X } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type RecipientType = "admins" | "investors" | "active_contractors" | "alumni_contractors";

interface RecipientCounts {
  admins: number;
  investors: number;
  activeContractors: number;
  alumniContractors: number;
}

interface RecipientSelectorProps {
  value: RecipientType[];
  onChange: (value: RecipientType[]) => void;
  counts: RecipientCounts;
  minBilledAmount?: number | undefined;
  onMinBilledAmountChange?: (amount: number | undefined) => void;
}

const recipientOptions: { value: RecipientType; label: string }[] = [
  { value: "admins", label: "Admins" },
  { value: "investors", label: "Investors" },
  { value: "active_contractors", label: "Active contractors" },
  { value: "alumni_contractors", label: "Alumni contractors" },
];

export default function RecipientSelector({
  value,
  onChange,
  counts,
  minBilledAmount,
  onMinBilledAmountChange,
}: RecipientSelectorProps) {
  const [open, setOpen] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [showMinBilled, setShowMinBilled] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const getCountForType = (type: RecipientType): number => {
    switch (type) {
      case "admins":
        return counts.admins;
      case "investors":
        return counts.investors;
      case "active_contractors":
        return counts.activeContractors;
      case "alumni_contractors":
        return counts.alumniContractors;
      default:
        return 0;
    }
  };

  const totalRecipients = useMemo(
    () =>
      // TODO: This currently just sums the counts and doesn't deduplicate users who belong to multiple groups
      // Should be replaced with a server-side query that returns the actual unique recipient count
      value.reduce((sum, type) => sum + getCountForType(type), 0),
    [value, counts],
  );

  // Filter options based on search text and hide already selected items
  const filteredOptions = useMemo(
    () =>
      recipientOptions.filter((option) => {
        // Hide already selected items
        if (value.includes(option.value)) return false;
        // Filter by search text
        if (filterText && !option.label.toLowerCase().includes(filterText.toLowerCase())) return false;
        return true;
      }),
    [filterText, value],
  );

  const hasContractors = value.includes("active_contractors") || value.includes("alumni_contractors");

  const handleToggle = (type: RecipientType) => {
    // Admins must always be selected
    if (type === "admins") return;

    if (value.includes(type)) {
      onChange(value.filter((t) => t !== type));
    } else {
      onChange([...value, type]);
    }
  };

  const handleRemove = (type: RecipientType, e: React.MouseEvent) => {
    e.stopPropagation();
    // Admins must always be selected
    if (type === "admins") return;
    onChange(value.filter((t) => t !== type));
  };

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Handle backspace for removing badges when no filter text
      if ((e.key === "Delete" || e.key === "Backspace") && !filterText && value.length > 0) {
        const lastItem = value[value.length - 1];
        if (lastItem !== "admins") {
          e.preventDefault();
          onChange(value.slice(0, -1));
        }
        return;
      }

      if (!open) {
        if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
          e.preventDefault();
          setOpen(true);
          setFocusedIndex(0);
        }
      } else {
        switch (e.key) {
          case "ArrowDown":
            e.preventDefault();
            e.stopPropagation();
            setFocusedIndex((prev) => {
              const next = prev + 1;
              return next >= filteredOptions.length ? 0 : next;
            });
            break;
          case "ArrowUp":
            e.preventDefault();
            e.stopPropagation();
            setFocusedIndex((prev) => {
              const next = prev - 1;
              return next < 0 ? filteredOptions.length - 1 : next;
            });
            break;
          case "Enter":
            e.preventDefault();
            e.stopPropagation();
            if (filteredOptions[focusedIndex]) {
              handleToggle(filteredOptions[focusedIndex].value);
              setFilterText("");
            }
            break;
          case "Escape":
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
            setFilterText("");
            break;
        }
      }
    },
    [value, onChange, open, filteredOptions, focusedIndex, filterText],
  );

  useEffect(() => {
    if (open) {
      // Focus the input when dropdown opens
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Reset focused index when filtered options change
  useEffect(() => {
    setFocusedIndex(0);
  }, [filteredOptions]);

  const getLabel = (type: RecipientType) => {
    const option = recipientOptions.find((o) => o.value === type);
    return option?.label || type;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Recipients</Label>
        <span className="text-muted-foreground text-sm">{totalRecipients} recipients</span>
      </div>
      <div ref={dropdownRef}>
        <DropdownMenu
          open={open}
          onOpenChange={(newOpen) => {
            setOpen(newOpen);
            if (!newOpen) {
              setFilterText("");
            }
          }}
        >
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-start text-left font-normal"
              onKeyDown={handleKeyDown}
              onClick={() => setOpen(true)}
            >
              <div className="flex flex-1 flex-wrap items-center gap-1">
                {value.map((type) => (
                  <span
                    key={type}
                    className="inline-flex items-center gap-1 rounded bg-gray-50 px-2 py-0.5 text-sm font-normal text-gray-900"
                    style={{ backgroundColor: "rgba(29, 30, 23, 0.03)" }}
                  >
                    {getLabel(type)}
                    {type !== "admins" && (
                      <button
                        type="button"
                        onClick={(e) => handleRemove(type, e)}
                        className="ring-offset-background focus:ring-ring ml-0.5 rounded-full outline-none focus:ring-2 focus:ring-offset-2"
                        aria-label={`Remove ${getLabel(type)}`}
                      >
                        <X className="h-3 w-3 text-gray-400 hover:text-gray-600" />
                      </button>
                    )}
                  </span>
                ))}
                <input
                  ref={inputRef}
                  type="text"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  onKeyDown={(e) => {
                    // Don't prevent default for regular typing
                    if (
                      !["ArrowDown", "ArrowUp", "Enter", "Escape", "Delete", "Backspace"].includes(e.key) ||
                      (e.key === "Backspace" && filterText)
                    ) {
                      return;
                    }
                    handleKeyDown(e);
                  }}
                  placeholder="Select recipients..."
                  className="placeholder:text-muted-foreground min-w-[120px] flex-1 bg-transparent text-sm outline-none"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(true);
                  }}
                />
              </div>
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)]">
            {filteredOptions.length === 0 ? (
              <div className="text-muted-foreground px-2 py-6 text-center text-sm">
                {filterText ? "No matching recipients" : "All recipient groups selected"}
              </div>
            ) : (
              filteredOptions.map((option, index) => {
                const count = getCountForType(option.value);
                const isFocused = index === focusedIndex;

                return (
                  <DropdownMenuItem
                    key={option.value}
                    className={`cursor-pointer justify-between ${isFocused ? "bg-gray-100" : ""}`}
                    onSelect={(e) => {
                      e.preventDefault();
                      handleToggle(option.value);
                      setFilterText("");
                      // Keep dropdown open after selection for multiple selections
                    }}
                    onMouseEnter={() => setFocusedIndex(index)}
                    onFocus={() => setFocusedIndex(index)}
                  >
                    <span>{option.label}</span>
                    <span className="text-muted-foreground">{count}</span>
                  </DropdownMenuItem>
                );
              })
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {!hasContractors && (
        <p className="text-muted-foreground mt-2 text-sm">Duplicate recipients will be removed automatically.</p>
      )}

      {hasContractors && onMinBilledAmountChange ? (
        <div className="mt-2 space-y-3">
          <button
            type="button"
            onClick={() => setShowMinBilled(!showMinBilled)}
            className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            <span className="text-base">{showMinBilled ? "−" : "+"}</span>
            Set min billed amount
          </button>
          {showMinBilled ? (
            <div className="space-y-2">
              <Label htmlFor="min-billed-amount" className="text-sm font-normal text-gray-700">
                Contractors must've billed at least this amount
              </Label>
              <div className="relative">
                <span className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-500">$</span>
                <Input
                  id="min-billed-amount"
                  type="number"
                  placeholder="0"
                  value={minBilledAmount ?? ""}
                  onChange={(e) => {
                    const value = e.target.value ? parseFloat(e.target.value) : undefined;
                    onMinBilledAmountChange(value);
                  }}
                  className="pl-8"
                />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
