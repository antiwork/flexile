import { Columns2 } from "lucide-react";
import React, { useState } from "react";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { storageKeys } from "@/models/constants";

export interface ColumnConfig {
  id: string;
  label: string;
  isDefault: boolean;
  canHide: boolean;
  category: "base" | "shareClass" | "options";
}

type ColumnVisibility = Record<string, boolean>;

const columnVisibilitySchema = z.record(z.string(), z.boolean());

export function useColumnSettings(columns: ColumnConfig[], dataLoaded = true) {
  const getDefaultVisibility = () => {
    const defaultState: ColumnVisibility = {};
    columns.forEach((column) => {
      defaultState[column.id] = column.canHide ? column.isDefault : true;
    });
    return defaultState;
  };

  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>(getDefaultVisibility);
  const [hasLoadedFromStorage, setHasLoadedFromStorage] = useState(false);

  React.useEffect(() => {
    if (!dataLoaded || columns.length === 0 || hasLoadedFromStorage) return;

    const storedVisibility = columnVisibilitySchema.safeParse(
      JSON.parse(localStorage.getItem(storageKeys.INVESTORS_COLUMN_SETTINGS) ?? "{}"),
    );

    if (storedVisibility.success) {
      const merged: ColumnVisibility = {};
      columns.forEach((column) => {
        if (column.canHide) {
          merged[column.id] = storedVisibility.data[column.id] ?? column.isDefault;
        } else {
          merged[column.id] = true;
        }
      });
      setColumnVisibility(merged);
    }
    setHasLoadedFromStorage(true);
  }, [dataLoaded, columns.length, hasLoadedFromStorage]);

  const toggleColumn = (columnId: string) => {
    const column = columns.find((col) => col.id === columnId);
    if (!column?.canHide) return;

    setColumnVisibility((prev) => {
      const newVisibility = { ...prev, [columnId]: !prev[columnId] };
      localStorage.setItem(storageKeys.INVESTORS_COLUMN_SETTINGS, JSON.stringify(newVisibility));
      return newVisibility;
    });
  };

  const resetToDefaults = () => {
    const defaultState = getDefaultVisibility();
    setColumnVisibility(defaultState);
    localStorage.setItem(storageKeys.INVESTORS_COLUMN_SETTINGS, JSON.stringify(defaultState));
  };

  const isColumnVisible = (columnId: string) => columnVisibility[columnId] ?? false;

  return {
    columnVisibility,
    toggleColumn,
    resetToDefaults,
    isColumnVisible,
  };
}

const categoryLabels: Record<string, string> = {
  base: "Ownership",
  shareClass: "Share classes",
  options: "Option strikes",
};

export const ColumnSettingsToggle = ({
  columns,
  columnVisibility,
  onToggleColumn,
  onResetToDefaults,
}: {
  columns: ColumnConfig[];
  columnVisibility: Record<string, boolean>;
  onToggleColumn: (columnId: string) => void;
  onResetToDefaults: () => void;
}) => {
  const visibleCount = columns.filter((col) => columnVisibility[col.id]).length;

  const categorizedColumns = columns.reduce<Record<string, ColumnConfig[]>>((acc, column) => {
    const category = column.category;
    if (!acc[category]) acc[category] = [];
    acc[category].push(column);
    return acc;
  }, {});

  const isDefaultState = columns.every((column) => {
    const currentlyVisible = columnVisibility[column.id] ?? false;
    const shouldBeVisible = column.canHide ? column.isDefault : true;
    return currentlyVisible === shouldBeVisible;
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="small">
          <div className="flex items-center gap-1">
            <Columns2 className="size-4" />
            Columns
            <Badge variant="secondary" className="rounded-sm px-1 font-normal">
              {visibleCount}
            </Badge>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {Object.entries(categorizedColumns).map(([category, categoryColumns]) => {
          const categoryLabel = categoryLabels[category] || category;

          return (
            <DropdownMenuSub key={category}>
              <DropdownMenuSubTrigger>
                <span>{categoryLabel}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {categoryColumns.map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={columnVisibility[column.id] ?? false}
                    onCheckedChange={() => {
                      if (column.canHide) {
                        onToggleColumn(column.id);
                      }
                    }}
                    disabled={!column.canHide}
                  >
                    {column.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          );
        })}
        {!isDefaultState && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onResetToDefaults}>
              Reset to defaults
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
