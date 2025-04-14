"use client";
import { CheckCircleIcon, TrashIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useMemo, useState } from "react";
import CardLink from "@/components/CardLink";
import MainLayout from "@/components/layouts/Main";
import Modal from "@/components/Modal";
import MutationButton from "@/components/MutationButton";
import PaginationSection, { usePage } from "@/components/PaginationSection";
import Placeholder from "@/components/Placeholder";
import Status from "@/components/Status";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { trpc } from "@/trpc/client";
import { formatDate } from "@/utils/time";

const perPage = 50;
const useData = () => {
  const company = useCurrentCompany();
  const [page] = usePage();
  const [data] = trpc.companyUpdates.list.useSuspenseQuery({ companyId: company.id, perPage, page });
  return data;
};

export default function CompanyUpdates() {
  const user = useCurrentUser();
  const data = useData();

  return (
    <MainLayout
      title="Updates"
      headerActions={
        user.activeRole === "administrator" ? (
          <Button asChild>
            <Link href="/updates/company/new">New update</Link>
          </Button>
        ) : null
      }
    >
      {data.updates.length ? (
        <>
          {user.activeRole === "administrator" ? <AdminList /> : <ViewList />}
          <PaginationSection total={data.total} perPage={perPage} />
        </>
      ) : (
        <Placeholder icon={CheckCircleIcon}>No updates to display.</Placeholder>
      )}
    </MainLayout>
  );
}

const AdminList = () => {
  const data = useData();
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

  const columnHelper = createColumnHelper<(typeof data.updates)[number]>();
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
            <TrashIcon className="size-4" />
          </Button>
        ),
      }),
    ],
    [],
  );

  const table = useTable({ columns, data: data.updates });

  return (
    <>
      <Table table={table} onRowClicked={(row) => router.push(`/updates/company/${row.id}/edit`)} />
      <Modal open={!!deletingUpdate} title="Delete update?" onClose={() => setDeletingUpdate(null)}>
        <p>
          "{data.updates.find((update) => update.id === deletingUpdate)?.title}" will be permanently deleted and cannot
          be restored.
        </p>
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
      </Modal>
    </>
  );
};

const ViewList = () => {
  const data = useData();
  return data.updates.map((update) => (
    <CardLink
      key={update.id}
      href={`/updates/company/${update.id}`}
      title={update.title}
      description={update.summary}
    />
  ));
};
