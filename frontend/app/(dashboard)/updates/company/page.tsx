"use client";
import { ArrowRight, CircleCheck, Trash } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useMemo, useState } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import MutationButton from "@/components/MutationButton";
import Placeholder from "@/components/Placeholder";
import Status from "@/components/Status";
import TableSkeleton from "@/components/TableSkeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { trpc } from "@/trpc/client";
import { formatDate } from "@/utils/time";

const useData = () => {
  const company = useCurrentCompany();
  const { data = { updates: [] }, isLoading } = trpc.companyUpdates.list.useQuery({ companyId: company.id });
  return { updates: data.updates, isLoading };
};

export default function CompanyUpdates() {
  const user = useCurrentUser();
  const { updates, isLoading } = useData();

  return (
    <>
      <DashboardHeader
        title="Updates"
        headerActions={
          user.roles.administrator ? (
            <Button asChild>
              <Link href="/updates/company/new">New update</Link>
            </Button>
          ) : null
        }
      />

      {isLoading ? (
        <TableSkeleton columns={4} />
      ) : updates.length ? (
        user.roles.administrator ? (
          <AdminList />
        ) : (
          <ViewList />
        )
      ) : (
        <Placeholder icon={CircleCheck}>No updates to display.</Placeholder>
      )}
    </>
  );
}

const AdminList = () => {
  const { updates } = useData();
  const company = useCurrentCompany();
  const router = useRouter();
  const trpcUtils = trpc.useUtils();

  const [deletingUpdate, setDeletingUpdate] = useState<string | null>(null);

  const deleteMutation = trpc.companyUpdates.delete.useMutation({
    onSuccess: () => {
      void trpcUtils.companyUpdates.list.invalidate();
      setDeletingUpdate(null);
    },
  });

  const columnHelper = createColumnHelper<(typeof updates)[number]>();
  const columns = useMemo(
    () => [
      columnHelper.simple("sentAt", "Sent on", (v) => (v ? formatDate(v) : "-")),
      columnHelper.accessor("title", {
        header: "Title",
        cell: (info) => (
          <Link href={`/updates/company/${info.row.original.id}/edit`} className="no-underline">
            {info.getValue()}
          </Link>
        ),
      }),
      columnHelper.accessor((row) => (row.sentAt ? "Sent" : "Draft"), {
        header: "Status",
        cell: (info) => <Status variant={info.getValue() === "Sent" ? "success" : undefined}>{info.getValue()}</Status>,
      }),
      columnHelper.display({
        id: "actions",
        cell: (info) => (
          <Button
            aria-label="Remove"
            variant="outline"
            onClick={() => setDeletingUpdate(info.row.original.id)}
            className="inline-flex cursor-pointer items-center border-none bg-transparent text-inherit underline hover:text-blue-600"
          >
            <Trash className="size-4" />
          </Button>
        ),
      }),
    ],
    [],
  );

  const table = useTable({ columns, data: updates });

  return (
    <>
      <DataTable table={table} onRowClicked={(row) => router.push(`/updates/company/${row.id}/edit`)} />
      <Dialog open={!!deletingUpdate} onOpenChange={() => setDeletingUpdate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete update?</DialogTitle>
          </DialogHeader>
          <p>
            "{updates.find((update) => update.id === deletingUpdate)?.title}" will be permanently deleted and cannot be
            restored.
          </p>
          <DialogFooter>
            <div className="grid auto-cols-fr grid-flow-col items-center gap-3">
              <Button variant="outline" onClick={() => setDeletingUpdate(null)}>
                No, cancel
              </Button>
              <MutationButton
                mutation={deleteMutation}
                param={{ companyId: company.id, id: deletingUpdate ?? "" }}
                loadingText="Deleting..."
              >
                Yes, delete
              </MutationButton>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

const ViewList = () => {
  const { updates } = useData();
  return updates.map((update) => (
    <Link key={update.id} href={`/updates/company/${update.id}`}>
      <Card>
        <CardContent className="grid grid-cols-[1fr_auto] items-center">
          <div className="grid gap-4">
            <h4 className="text-xl font-bold">{update.title}</h4>
            <p className="line-clamp-2">{update.summary}</p>
          </div>
          <ArrowRight className="size-7" />
        </CardContent>
      </Card>
    </Link>
  ));
};
