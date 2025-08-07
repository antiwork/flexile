"use client";

import { Check, ChevronDown, Users, X } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
}

const recipientOptions: { value: RecipientType; label: string; icon: typeof Users }[] = [
  { value: "admins", label: "Admins", icon: Users },
  { value: "investors", label: "Investors", icon: Users },
  { value: "active_contractors", label: "Active contractors", icon: Users },
  { value: "alumni_contractors", label: "Alumni contractors", icon: Users },
];

export default function RecipientSelector({ value, onChange, counts }: RecipientSelectorProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
      // This is a simplified calculation - in reality, we'd need to de-duplicate
      // across categories, but for now we'll just sum them up
      value.reduce((sum, type) => sum + getCountForType(type), 0),
    [value, counts],
  );

  const handleToggle = (type: RecipientType) => {
    if (value.includes(type)) {
      onChange(value.filter((t) => t !== type));
    } else {
      onChange([...value, type]);
    }
  };

  const handleRemove = (type: RecipientType, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(value.filter((t) => t !== type));
  };

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && value.length > 0) {
        e.preventDefault();
        onChange(value.slice(0, -1));
      }
    },
    [value, onChange],
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target instanceof Node ? event.target : null)) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const getLabel = (type: RecipientType) => {
    const option = recipientOptions.find((o) => o.value === type);
    return option?.label || type;
  };

  return (
    <div className="space-y-2">
      <Label>Recipients ({totalRecipients.toLocaleString()})</Label>
      <div ref={dropdownRef}>
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full justify-between" onKeyDown={handleKeyDown}>
              <div className="flex flex-1 flex-wrap items-center gap-1">
                {value.length === 0 ? (
                  <span className="text-muted-foreground">Select recipients</span>
                ) : (
                  value.map((type) => (
                    <Badge key={type} variant="secondary" className="gap-1">
                      {getLabel(type)}
                      <button
                        type="button"
                        onClick={(e) => handleRemove(type, e)}
                        className="ring-offset-background focus:ring-ring ml-1 rounded-full outline-none focus:ring-2 focus:ring-offset-2"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))
                )}
              </div>
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)]">
            {recipientOptions.map((option) => {
              const count = getCountForType(option.value);
              const isSelected = value.includes(option.value);
              const Icon = option.icon;

              return (
                <DropdownMenuItem
                  key={option.value}
                  className="justify-between"
                  onSelect={(e) => {
                    e.preventDefault();
                    handleToggle(option.value);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span>{option.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{count.toLocaleString()}</span>
                    {isSelected ? <Check className="h-4 w-4" /> : null}
                  </div>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
