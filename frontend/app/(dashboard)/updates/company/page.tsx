"use client";
import { CircleCheck, Plus, Trash2 } from "lucide-react";
import React, { useMemo, useState } from "react";
import CompanyUpdateModal from "@/app/(dashboard)/updates/company/CompanyUpdateModal";
import ViewUpdateDialog from "@/app/(dashboard)/updates/company/ViewUpdateDialog";
import { DashboardHeader } from "@/components/DashboardHeader";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import MutationButton from "@/components/MutationButton";
import Placeholder from "@/components/Placeholder";
import Status from "@/components/Status";
import TableSkeleton from "@/components/TableSkeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { trpc } from "@/trpc/client";
import { formatDate } from "@/utils/time";
import { useIsMobile } from "@/utils/use-mobile";

const useData = () => {
  const company = useCurrentCompany();
  const { data = { updates: [] }, isLoading } = trpc.companyUpdates.list.useQuery({ companyId: company.id });
  return { updates: data.updates, isLoading };
};

type UpdateListItem = ReturnType<typeof useData>["updates"][number];

export default function CompanyUpdates() {
  const isMobile = useIsMobile();
  const user = useCurrentUser();
  const { updates, isLoading } = useData();
  const [showModal, setShowModal] = useState(false);
  const [editingUpdateId, setEditingUpdateId] = useState<string | undefined>(undefined);

  const handleNewUpdate = () => {
    setEditingUpdateId(undefined);
    setShowModal(true);
  };

  const handleEditUpdate = (update: UpdateListItem) => {
    setEditingUpdateId(update.id);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingUpdateId(undefined);
  };

  return (
    <>
      <DashboardHeader
        title="Updates"
        headerActions={
          user.roles.administrator ? (
            isMobile ? (
              <Button variant="floating-action" onClick={handleNewUpdate}>
                <Plus />
              </Button>
            ) : (
              <Button onClick={handleNewUpdate}>New update</Button>
            )
          ) : null
        }
      />

      {isLoading ? (
        <TableSkeleton columns={user.roles.administrator ? 4 : 3} />
      ) : updates.length ? (
        user.roles.administrator ? (
          <AdminList onEditUpdate={handleEditUpdate} />
        ) : (
          <ViewList />
        )
      ) : (
        <div className="mx-4">
          <Placeholder icon={CircleCheck}>No updates to display.</Placeholder>
        </div>
      )}

      <CompanyUpdateModal
        open={showModal}
        onClose={handleCloseModal}
        {...(editingUpdateId && { updateId: editingUpdateId })}
      />
    </>
  );
}

const AdminList = ({ onEditUpdate }: { onEditUpdate: (update: UpdateListItem) => void }) => {
  const { updates } = useData();
  const company = useCurrentCompany();
  const trpcUtils = trpc.useUtils();
  const isMobile = useIsMobile();

  const [deletingUpdate, setDeletingUpdate] = useState<string | null>(null);

  const deleteMutation = trpc.companyUpdates.delete.useMutation({
    onSuccess: () => {
      void trpcUtils.companyUpdates.list.invalidate();
      setDeletingUpdate(null);
    },
  });

  const columnHelper = createColumnHelper<(typeof updates)[number]>();
  const desktopColumns = useMemo(
    () => [
      columnHelper.accessor("title", {
        header: "Title",
        cell: (info) => (
          <button onClick={() => onEditUpdate(info.row.original)} className="text-left no-underline hover:underline">
            {info.getValue()}
          </button>
        ),
      }),
      columnHelper.simple("sentAt", "Sent On", (v) => (v ? formatDate(v) : "-")),
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
            onClick={(e) => {
              e.stopPropagation();
              setDeletingUpdate(info.row.original.id);
            }}
            className="inline-flex cursor-pointer items-center border-none bg-transparent text-inherit underline hover:text-blue-600"
          >
            <Trash2 className="size-4" />
          </Button>
        ),
      }),
    ],
    [onEditUpdate],
  );

  const mobileColumns = useMemo(
    () => [
      columnHelper.display({
        id: "titleSummary",
        cell: (info) => {
          const update = info.row.original;
          return (
            <div className="flex w-3xs flex-col gap-2">
              <div>
                <div className="truncate text-base font-medium">{update.title}</div>
                <div className="truncate font-normal text-gray-600">{update.summary}</div>
              </div>
            </div>
          );
        },
        meta: {
          cellClassName: "w-full",
        },
      }),
      columnHelper.display({
        id: "statusSentOn",
        cell: (info) => {
          const update = info.row.original;

          return (
            <div className="flex h-full flex-col items-end justify-between">
              <div className="flex h-5 w-4 items-center justify-center">
                <Status variant={update.sentAt ? "success" : undefined} />
              </div>
              <div className="text-gray-600">{update.sentAt ? formatDate(update.sentAt) : "-"}</div>
            </div>
          );
        },
      }),
    ],
    [onEditUpdate],
  );

  const columns = isMobile ? mobileColumns : desktopColumns;
  const table = useTable({ columns, data: updates });

  return (
    <>
      <DataTable table={table} onRowClicked={(row) => onEditUpdate(row)} />
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
  const [selectedUpdateId, setSelectedUpdateId] = useState<string | null>(null);
  const columnHelper = createColumnHelper<(typeof updates)[number]>();
  const columns = useMemo(
    () => [
      columnHelper.simple("title", "Title"),
      columnHelper.accessor("summary", {
        header: "Summary",
        cell: (info) => <div className="whitespace-normal">{info.getValue()}</div>,
      }),
      columnHelper.simple("sentAt", "Published On", (v) => (v ? formatDate(v) : "-")),
    ],
    [],
  );
  const table = useTable({ columns, data: updates });
  const handleRowClick = (row: { id: string }) => setSelectedUpdateId(row.id);

  return (
    <>
      <DataTable table={table} onRowClicked={handleRowClick} />
      {selectedUpdateId ? (
        <ViewUpdateDialog updateId={selectedUpdateId} onOpenChange={() => setSelectedUpdateId(null)} />
      ) : null}
    </>
  );
};
