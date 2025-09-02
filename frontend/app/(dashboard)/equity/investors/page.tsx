"use client";
import { Check, CircleCheck, Mail, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import { getAvailableActions, SelectionActions } from "@/components/actions/SelectionActions";
import type { ActionConfig, ActionContext, AvailableActions } from "@/components/actions/types";
import { DashboardHeader } from "@/components/DashboardHeader";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import { linkClasses } from "@/components/Link";
import Placeholder from "@/components/Placeholder";
import TableSkeleton from "@/components/TableSkeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCurrentCompany, useCurrentUser } from "@/global";
import {
  fetchInvestorEmail,
  fetchInvestorId,
  fetchInvestorUserId,
  isInvestor,
  isInvestorForAdmin,
} from "@/models/investor";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { formatOwnershipPercentage } from "@/utils/numbers";
import { useIsMobile } from "@/utils/use-mobile";
import { type ColumnConfig, ColumnSettingsToggle, useColumnSettings } from "./ColumnSettings";

type Data = RouterOutput["capTable"]["show"];
type InvestorItem = Data["investors"][number];

export default function CapTable() {
  const company = useCurrentCompany();
  const searchParams = useSearchParams();
  const newSchema = searchParams.get("new_schema") !== null;
  const {
    data = {
      investors: [],
      shareClasses: [],
      optionPools: [],
      outstandingShares: "",
      fullyDilutedShares: "",
      allShareClasses: [],
      exercisePrices: [],
    },
    isLoading,
  } = trpc.capTable.show.useQuery({
    companyId: company.id,
    newSchema,
  });
  const user = useCurrentUser();
  const canViewInvestor = !!user.roles.administrator || !!user.roles.lawyer;

  const investorColumnHelper = createColumnHelper<InvestorItem>();

  const columnConfigs = useMemo((): ColumnConfig[] => {
    const commonDefaultConfig = { isDefault: true, canHide: true, category: "base" as const };
    const configs: ColumnConfig[] = [
      { id: "name", label: "Name", isDefault: true, canHide: false, category: "base" },
      { id: "outstandingShares", label: "Outstanding shares", ...commonDefaultConfig },
      { id: "outstandingOwnership", label: "Outstanding ownership", ...commonDefaultConfig },
      { id: "fullyDilutedShares", label: "Fully diluted shares", ...commonDefaultConfig },
      { id: "fullyDilutedOwnership", label: "Fully diluted ownership", ...commonDefaultConfig },
    ];
    data.allShareClasses.forEach((shareClassName) => {
      configs.push({
        id: `shareClass_${shareClassName}`,
        label: shareClassName,
        isDefault: false,
        canHide: true,
        category: "shareClass",
      });
    });
    data.exercisePrices.forEach((strikePrice) => {
      configs.push({
        id: `option_${strikePrice}`,
        label: `Common options ${strikePrice} strike`,
        isDefault: false,
        canHide: true,
        category: "options",
      });
    });

    return configs;
  }, [data.allShareClasses, data.exercisePrices]);

  const { columnVisibility, toggleColumn, resetToDefaults, isColumnVisible } = useColumnSettings(
    columnConfigs,
    !isLoading,
  );

  const investorRowLink = (investor: InvestorItem) => {
    const selectedTab = isInvestor(investor) && investor.outstandingShares > 0 ? "shares" : "options";
    if (newSchema) {
      const id = fetchInvestorId(investor);
      if (id === null) return "#";
      return `/companies/${company.id}/investor_entities/${id}?tab=${selectedTab}`;
    }
    const userId = fetchInvestorUserId(investor);
    if (userId === null) return "#";
    return `/people/${userId}?tab=${selectedTab}`;
  };

  const investorsColumns = useMemo(() => {
    const allColumns = [];

    if (isColumnVisible("name")) {
      allColumns.push(
        investorColumnHelper.accessor("name", {
          header: "Name",
          cell: (info) => {
            const investor = info.row.original;
            const contents = (
              <div className="flex flex-wrap gap-1">
                <strong>{info.getValue()}</strong>
                {isInvestorForAdmin(investor) && investor.email}
              </div>
            );
            return canViewInvestor && isInvestor(investor) ? (
              <a href={investorRowLink(investor)} className={linkClasses}>
                {contents}
              </a>
            ) : (
              contents
            );
          },
          footer: "Total",
        }),
      );
    }

    if (isColumnVisible("outstandingShares")) {
      allColumns.push(
        investorColumnHelper.accessor((row) => (isInvestor(row) ? row.outstandingShares : undefined), {
          header: "Outstanding shares",
          cell: (info) => (info.getValue() ?? 0).toLocaleString(),
          meta: { numeric: true },
          footer: data.outstandingShares.toLocaleString(),
        }),
      );
    }

    if (isColumnVisible("outstandingOwnership")) {
      allColumns.push(
        investorColumnHelper.accessor((row) => (isInvestor(row) ? row.outstandingShares : undefined), {
          header: "Outstanding ownership",
          cell: (info) => {
            const value = info.getValue();
            const ownershipPercentage = value ? Number(value) / Number(data.outstandingShares) : 0;
            return formatOwnershipPercentage(ownershipPercentage);
          },
          meta: { numeric: true },
          footer: "100%",
        }),
      );
    }

    if (isColumnVisible("fullyDilutedShares")) {
      allColumns.push(
        investorColumnHelper.accessor(
          (row) =>
            "fullyDilutedShares" in row
              ? row.fullyDilutedShares
              : "availableShares" in row
                ? row.availableShares
                : undefined,
          {
            header: "Fully diluted shares",
            cell: (info) => Number(info.getValue() ?? 0).toLocaleString(),
            meta: { numeric: true },
            footer: data.fullyDilutedShares.toLocaleString(),
          },
        ),
      );
    }

    if (isColumnVisible("fullyDilutedOwnership")) {
      allColumns.push(
        investorColumnHelper.accessor(
          (row) => {
            if ("fullyDilutedShares" in row && row.fullyDilutedShares) {
              return row.fullyDilutedShares;
            }
            if ("availableShares" in row && row.availableShares) {
              return row.availableShares;
            }
            return undefined;
          },
          {
            header: "Fully diluted ownership",
            cell: (info) => {
              const value = info.getValue();
              const ownershipPercentage = value ? Number(value) / Number(data.fullyDilutedShares) : 0;
              return formatOwnershipPercentage(ownershipPercentage);
            },
            meta: { numeric: true },
            footer: "100%",
          },
        ),
      );
    }

    data.allShareClasses.forEach((shareClassName) => {
      if (isColumnVisible(`shareClass_${shareClassName}`)) {
        const total = data.investors.reduce((sum, investor) => {
          if (isInvestor(investor)) {
            return sum + (investor.sharesByClass[shareClassName] || 0);
          }
          return sum;
        }, 0);

        allColumns.push(
          investorColumnHelper.accessor((row) => row.sharesByClass?.[shareClassName] || 0, {
            header: shareClassName,
            cell: (info) => {
              const value = info.getValue();
              return value > 0 ? value.toLocaleString() : "0";
            },
            meta: { numeric: true },
            footer: total > 0 ? total.toLocaleString() : "0",
          }),
        );
      }
    });

    data.exercisePrices.forEach((strikePrice) => {
      if (isColumnVisible(`option_${strikePrice}`)) {
        const total = data.investors.reduce((sum, investor) => {
          if (isInvestor(investor)) {
            return sum + (investor.optionsByStrike[strikePrice] || 0);
          }
          return sum;
        }, 0);

        allColumns.push(
          investorColumnHelper.accessor((row) => row.optionsByStrike?.[strikePrice] || 0, {
            header: `Common options ${strikePrice} strike`,
            cell: (info) => {
              const value = info.getValue();
              return value > 0 ? value.toLocaleString() : "0";
            },
            meta: { numeric: true },
            footer: total > 0 ? total.toLocaleString() : "0",
          }),
        );
      }
    });

    return allColumns;
  }, [data, canViewInvestor, isColumnVisible, columnVisibility]);

  const investorsData = useMemo(
    () => [
      ...data.investors,
      ...data.optionPools.map((pool) => ({
        name: `Options available (${pool.name})`,
        fullyDilutedShares: pool.availableShares,
      })),
    ],
    [data.investors, data.optionPools],
  );

  const investorsTable = useTable({
    data: investorsData,
    columns: investorsColumns,
    enableRowSelection: canViewInvestor ? (row) => isInvestor(row.original) : false,
  });

  const selectedInvestors = investorsTable.getSelectedRowModel().rows.map((row) => row.original);
  const actionConfig = useMemo(
    (): ActionConfig<InvestorItem> => ({
      entityName: "investors",
      actions: {
        contact: {
          id: "contact",
          label: "Contact",
          icon: Mail,
          variant: "primary",
          contexts: ["single", "bulk"],
          permissions: ["administrator", "lawyer"],
          conditions: (item: InvestorItem) => isInvestor(item) && !!fetchInvestorEmail(item),
          action: "contact",
          showIn: ["selection"],
        },
      },
    }),
    [],
  );

  const actionContext = useMemo<ActionContext>(
    () => ({
      userRole: user.roles.administrator ? "administrator" : user.roles.lawyer ? "lawyer" : "guest",
      permissions: {},
    }),
    [user.roles],
  );

  const availableActions = useMemo(
    () => getAvailableActions(selectedInvestors, actionConfig, actionContext),
    [selectedInvestors, actionConfig, actionContext],
  );
  const [copied, setCopied] = useState(false);
  const availableActionsForRender = useMemo(
    () =>
      availableActions.map((a) =>
        a.key === "contact" ? { ...a, label: copied ? "Copied!" : "Contact", icon: copied ? Check : Mail } : a,
      ),
    [availableActions, copied],
  );
  const handleAction = (actionId: string, items: InvestorItem[]): boolean => {
    switch (actionId) {
      case "contact": {
        const emails = items
          .filter(isInvestor)
          .map((inv) => fetchInvestorEmail(inv))
          .filter((email): email is string => !!email)
          .join(", ");
        if (!emails) return false;
        try {
          void navigator.clipboard.writeText(emails);
        } catch {
          const ta = document.createElement("textarea");
          ta.value = emails;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          try {
            document.execCommand("copy");
          } finally {
            document.body.removeChild(ta);
          }
        }
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
        return true;
      }
    }
    return false;
  };

  const isMobile = useIsMobile();

  return (
    <>
      <DashboardHeader
        title="Investors"
        headerActions={
          isMobile && canViewInvestor && investorsTable.getRowModel().rows.some((r) => r.getCanSelect()) ? (
            <button
              className="p-2 text-blue-600"
              onClick={() => investorsTable.toggleAllRowsSelected(!investorsTable.getIsAllRowsSelected())}
            >
              {investorsTable.getIsAllRowsSelected() ? "Unselect all" : "Select all"}
            </button>
          ) : undefined
        }
      />

      {isLoading ? (
        <TableSkeleton columns={columnConfigs.filter((config) => isColumnVisible(config.id)).length || 0} />
      ) : data.investors.length > 0 ? (
        <div className="overflow-x-auto">
          <div className="mx-4 mb-2 flex flex-row gap-2">
            <ColumnSettingsToggle
              columns={columnConfigs}
              columnVisibility={columnVisibility}
              onToggleColumn={toggleColumn}
              onResetToDefaults={resetToDefaults}
            />
            {!isMobile && canViewInvestor ? (
              <div className={`flex gap-2 ${selectedInvestors.length === 0 ? "pointer-events-none opacity-0" : ""}`}>
                <div className="bg-accent border-muted flex h-9 items-center justify-center rounded-md border border-dashed px-2 font-medium">
                  <span className="text-sm whitespace-nowrap">
                    <span className="inline-block w-4 text-center tabular-nums">{selectedInvestors.length}</span>{" "}
                    selected
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="-mr-1 size-6 p-0 hover:bg-transparent"
                    onClick={() => investorsTable.toggleAllRowsSelected(false)}
                  >
                    <X className="size-4 shrink-0" aria-hidden="true" />
                  </Button>
                </div>
                <SelectionActions
                  selectedItems={selectedInvestors}
                  config={actionConfig}
                  availableActions={availableActionsForRender}
                  onAction={handleAction}
                />
              </div>
            ) : null}
          </div>
          <DataTable table={investorsTable} />
        </div>
      ) : (
        <div className="mx-4">
          <Placeholder icon={CircleCheck}>There are no active investors right now.</Placeholder>
        </div>
      )}

      {isMobile ? (
        <InvestorBulkActionsBar
          availableActions={availableActions}
          selectedItems={selectedInvestors}
          onAction={handleAction}
          onClose={() => investorsTable.toggleAllRowsSelected(false)}
        />
      ) : null}
    </>
  );
}

function InvestorBulkActionsBar({
  selectedItems,
  onClose,
  availableActions,
  onAction,
}: {
  selectedItems: InvestorItem[];
  onClose: () => void;
  availableActions: AvailableActions<InvestorItem>[];
  onAction: (actionId: string, items: InvestorItem[]) => boolean;
}) {
  const [visibleItems, setVisibleItems] = useState<InvestorItem[]>([]);
  const [visibleActions, setVisibleActions] = useState<AvailableActions<InvestorItem>[]>([]);

  useEffect(() => {
    const isOpen = selectedItems.length > 0;
    if (isOpen) {
      setVisibleItems(selectedItems);
      setVisibleActions(availableActions);
    }
  }, [selectedItems, availableActions]);

  const rowsSelected = visibleItems.length;
  const contactAction = visibleActions.find((a) => a.key === "contact");

  return (
    <Dialog open={selectedItems.length > 0} modal={false}>
      <DialogContent className="border-border fixed right-auto bottom-16 left-1/2 w-auto -translate-x-1/2 transform rounded-xl border p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Selected investors</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2 p-2">
          <Button
            variant="outline"
            className="border-muted flex h-9 items-center gap-2 rounded-lg border border-dashed text-sm font-medium hover:bg-white"
            onClick={onClose}
          >
            <span className="tabular-nums">{rowsSelected}</span> selected
            <X className="size-4" />
          </Button>
          {contactAction ? <ContactCopyButton selectedItems={selectedItems} onAction={onAction} /> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ContactCopyButton({
  selectedItems,
  onAction,
}: {
  selectedItems: InvestorItem[];
  onAction: (actionId: string, items: InvestorItem[]) => boolean;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="primary"
      className="flex h-9 items-center gap-2 border-none text-sm"
      onClick={() => {
        const ok = onAction("contact", selectedItems);
        if (ok) {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        }
      }}
    >
      {copied ? <Check className="size-3.5" strokeWidth={2.5} /> : <Mail className="size-3.5" strokeWidth={2.5} />}
      {copied ? "Copied!" : "Contact"}
    </Button>
  );
}
