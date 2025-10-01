"use client";
import { CircleCheck, Plus } from "lucide-react";
import React from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import Placeholder from "@/components/Placeholder";
import TableSkeleton from "@/components/TableSkeleton";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useCurrentCompany, useCurrentUser } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { useIsMobile } from "@/utils/use-mobile";
import NewOptionPoolModal from "./NewOptionPoolModal";

type OptionPool = RouterOutput["optionPools"]["list"][number];

const columnHelper = createColumnHelper<OptionPool>();
const columns = [
  columnHelper.simple("name", "Name", (value) => <strong>{value}</strong>),
  columnHelper.simple("authorizedShares", "Authorized shares", (value) => value.toLocaleString(), "numeric"),
  columnHelper.simple("issuedShares", "Issued shares", (value) => value.toLocaleString(), "numeric"),
  columnHelper.display({
    id: "progress",
    cell: (info) => (
      <Progress max={Number(info.row.original.authorizedShares)} value={Number(info.row.original.issuedShares)} />
    ),
  }),
  columnHelper.simple("availableShares", "Available shares", (value) => value.toLocaleString(), "numeric"),
];

export default function OptionPools() {
  const isMobile = useIsMobile();
  const company = useCurrentCompany();
  const user = useCurrentUser();
  const { data = [], isLoading } = trpc.optionPools.list.useQuery({ companyId: company.id });
  const [open, setOpen] = React.useState(false);

  const table = useTable({ columns, data });

  return (
    <>
      <DashboardHeader
        title="Option pools"
        headerActions={
          user.roles.administrator ? (
            isMobile ? (
              <Button variant="floating-action" onClick={() => setOpen(true)}>
                <Plus />
              </Button>
            ) : (
              <Button variant="primary" onClick={() => setOpen(true)}>
                New option pool
              </Button>
            )
          ) : null
        }
      />
      <NewOptionPoolModal open={open} onOpenChange={setOpen} />
      {isLoading ? (
        <TableSkeleton columns={5} />
      ) : data.length > 0 ? (
        <DataTable table={table} />
      ) : (
        <div className="mx-4">
          <Placeholder icon={CircleCheck}>The company does not have any option pools.</Placeholder>
        </div>
      )}
    </>
  );
}
