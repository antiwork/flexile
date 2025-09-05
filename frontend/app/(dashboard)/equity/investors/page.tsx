"use client";
import { CircleCheck, Mail, Plus, Users, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import React, { useMemo } from "react";
import CopyButton from "@/components/CopyButton";
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

  type InvestorItem = Data["investors"][number];
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
  const selectedInvestorEmails = selectedInvestors
    .map(fetchInvestorEmail)
    .filter((email): email is string => !!email)
    .join(", ");

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
                    <span className="inline-block text-center tabular-nums">{selectedInvestors.length}</span> selected
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
                <ContactSelectedCopyButton emails={selectedInvestorEmails} />
              </div>
            ) : null}
          </div>
          <DataTable table={investorsTable} />
        </div>
      ) : data.shareClasses.length > 0 || data.optionPools.length > 0 ? (
        <div className="mx-4">
          <Placeholder icon={CircleCheck}>There are no active investors right now.</Placeholder>
        </div>
      ) : (
        <div className="mx-4">
          <Placeholder icon={Users}>
            <div>Add your cap table to start managing equity and ownership records.</div>
            <Button variant="outline" size="default" asChild>
              <Link href="/equity/investors/add">
                <Plus className="size-4" />
                Add cap table
              </Link>
            </Button>
          </Placeholder>
        </div>
      )}

      {isMobile && selectedInvestors.length > 0 ? (
        <InvestorBulkActionsBar
          selectedCount={selectedInvestors.length}
          canContact={canViewInvestor}
          emails={selectedInvestorEmails}
          onClose={() => investorsTable.toggleAllRowsSelected(false)}
        />
      ) : null}
    </>
  );
}

const InvestorBulkActionsBar = ({
  selectedCount,
  canContact,
  emails,
  onClose,
}: {
  selectedCount: number;
  canContact: boolean;
  emails: string;
  onClose: () => void;
}) => (
  <Dialog open={selectedCount > 0} modal={false}>
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
          <span className="tabular-nums">{selectedCount}</span> selected
          <X className="size-4" />
        </Button>
        {canContact ? <ContactSelectedCopyButton emails={emails} /> : null}
      </div>
    </DialogContent>
  </Dialog>
);

const ContactSelectedCopyButton = ({ emails }: { emails: string }) => (
  <CopyButton variant="primary" className="flex h-9 items-center gap-2 border-none text-sm" copyText={emails}>
    <Mail className="size-3.5" strokeWidth={2.5} />
    Contact selected
  </CopyButton>
);
