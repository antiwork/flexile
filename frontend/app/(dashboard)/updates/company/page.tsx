"use client";
import { CircleCheck, Plus, Trash2, X } from "lucide-react";
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
              <Button size="small" onClick={handleNewUpdate}>
                New update
              </Button>
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
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const deleteMutation = trpc.companyUpdates.delete.useMutation({
    onSuccess: () => {
      void trpcUtils.companyUpdates.list.invalidate();
      setDeletingUpdate(null);
    },
  });

  const handleBulkDelete = async (updates: UpdateListItem[]) => {
    for (const update of updates) {
      await deleteMutation.mutateAsync({ companyId: company.id, id: update.id });
    }
    setShowBulkDeleteDialog(false);
  };

  const handleClearSelection = () => {
    table.resetRowSelection();
    setShowBulkDeleteDialog(false);
  };

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
            <div className="flex max-w-48 flex-col gap-2">
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
              <div className="flex h-5 items-center justify-center">
                <Status variant={update.sentAt ? "success" : undefined}>{update.sentAt ? "Sent" : "Draft"}</Status>
              </div>
              <div className="text-gray-600">{update.sentAt ? formatDate(update.sentAt) : "-"}</div>
            </div>
          );
        },
      }),
    ],
    [],
  );

  const columns = isMobile ? mobileColumns : desktopColumns;
  const table = useTable({
    columns,
    data: updates,
    enableRowSelection: isMobile,
    getRowId: (row) => row.id,
  });

  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const selectedUpdates = selectedRows.map((row) => row.original);

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
              <Button variant="outline" size="small" onClick={() => setDeletingUpdate(null)}>
                No, cancel
              </Button>
              <MutationButton
                mutation={deleteMutation}
                size="small"
                param={{ companyId: company.id, id: deletingUpdate ?? "" }}
                loadingText="Deleting..."
              >
                Yes, delete
              </MutationButton>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Delete {selectedUpdates.length} update{selectedUpdates.length === 1 ? "" : "s"}?
            </DialogTitle>
          </DialogHeader>
          <p>
            {selectedUpdates.length === 1
              ? `"${selectedUpdates[0]?.title}" will be permanently deleted and cannot be restored.`
              : `${selectedUpdates.length} updates will be permanently deleted and cannot be restored.`}
          </p>
          <DialogFooter>
            <div className="grid auto-cols-fr grid-flow-col items-center gap-3">
              <Button variant="outline" size="small" onClick={() => setShowBulkDeleteDialog(false)}>
                No, cancel
              </Button>
              <Button size="small" onClick={() => void handleBulkDelete(selectedUpdates)}>
                {`Yes, delete ${selectedUpdates.length === 1 ? "" : "all"}`}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isMobile && selectedUpdates.length > 0 ? (
        <UpdateBulkActionBar
          selectedUpdates={selectedUpdates}
          onClose={handleClearSelection}
          onDelete={() => setShowBulkDeleteDialog(true)}
        />
      ) : null}
    </>
  );
};

const ViewList = () => {
  const isMobile = useIsMobile();
  const { updates } = useData();
  const [selectedUpdateId, setSelectedUpdateId] = useState<string | null>(null);
  const columnHelper = createColumnHelper<(typeof updates)[number]>();
  const desktopColumns = useMemo(
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

  const mobileColumns = useMemo(
    () => [
      columnHelper.display({
        id: "update",
        cell: (info) => {
          const update = info.row.original;
          return (
            <div className="flex flex-col gap-1">
              <div className="flex">
                <div className="w-3xs truncate text-base font-medium">{update.title}</div>
                <div className="flex-1 text-right font-[350] text-gray-600">
                  {update.sentAt ? formatDate(update.sentAt) : "-"}
                </div>
              </div>
              <div
                className="truncate text-base leading-5 font-[350] text-gray-600"
                style={{ width: "calc(100vw - 40px)" }}
              >
                {update.summary}
              </div>
            </div>
          );
        },
        meta: {
          cellClassName: "w-full",
        },
      }),
    ],
    [],
  );

  const columns = isMobile ? mobileColumns : desktopColumns;
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

const UpdateBulkActionBar = ({
  selectedUpdates,
  onClose,
  onDelete,
}: {
  selectedUpdates: UpdateListItem[];
  onClose: () => void;
  onDelete: () => void;
}) => {
  if (!selectedUpdates.length) return null;

  return (
    <Dialog open={selectedUpdates.length > 0} modal={false}>
      <DialogContent
        showCloseButton={false}
        className="border-border fixed right-auto bottom-16 left-1/2 w-auto -translate-x-1/2 transform rounded-xl border p-0"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Bulk actions</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2 p-2">
          <Button
            variant="outline"
            className="border-muted flex h-9 items-center gap-2 rounded-lg border border-dashed text-sm font-medium hover:bg-white"
            onClick={onClose}
          >
            <span className="tabular-nums">{selectedUpdates.length}</span> selected
            <X className="size-4" />
          </Button>
          <Button variant="destructive" className="flex h-9 items-center gap-2 text-sm" onClick={() => onDelete()}>
            <Trash2 className="size-3.5" strokeWidth={2.5} />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
