"use client";
import { CircleCheck, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import Placeholder from "@/components/Placeholder";
import TableSkeleton from "@/components/TableSkeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCurrentCompany, useCurrentUser } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { formatMoney } from "@/utils/formatMoney";
import { formatDate } from "@/utils/time";
import { useIsMobile } from "@/utils/use-mobile";
import NewBuybackForm from "./NewBuyBack";

export default function Buybacks() {
  const isMobile = useIsMobile();
  const company = useCurrentCompany();
  const router = useRouter();
  const user = useCurrentUser();
  const [showBuyBackModal, setShowBuyBackModal] = useState(false);
  const { data = [], isLoading, refetch } = trpc.tenderOffers.list.useQuery({ companyId: company.id });

  const columnHelper = createColumnHelper<RouterOutput["tenderOffers"]["list"][number]>();
  const columns = [
    columnHelper.accessor("startsAt", {
      header: "Start date",
      cell: (info) => <Link href={`/equity/tender_offers/${info.row.original.id}`}>{formatDate(info.getValue())}</Link>,
    }),
    columnHelper.simple("endsAt", "End date", formatDate),
    columnHelper.simple("minimumValuation", "Starting valuation", formatMoney),
  ];

  const table = useTable({ columns, data });

  return (
    <>
      <DashboardHeader
        title="Buybacks"
        headerActions={
          user.roles.administrator ? (
            isMobile ? (
              <Button variant="floating-action" onClick={() => setShowBuyBackModal(true)}>
                <Plus className="size-4" />
              </Button>
            ) : (
              <Button size="small" variant="outline" onClick={() => setShowBuyBackModal(true)}>
                <Plus className="size-4" />
                New buyback
              </Button>
            )
          ) : null
        }
      />

      {isLoading ? (
        <TableSkeleton columns={3} />
      ) : data.length ? (
        <DataTable table={table} onRowClicked={(row) => router.push(`/equity/tender_offers/${row.id}`)} />
      ) : (
        <div className="mx-4">
          <Placeholder icon={CircleCheck}>There are no buybacks yet.</Placeholder>
        </div>
      )}

      <Dialog open={showBuyBackModal} onOpenChange={setShowBuyBackModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New buyback</DialogTitle>
          </DialogHeader>
          <NewBuybackForm
            handleComplete={() => {
              setShowBuyBackModal(false);
              void refetch();
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
