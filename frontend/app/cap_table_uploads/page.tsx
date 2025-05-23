"use client";

import { ArrowDownTrayIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import MainLayout from "@/app/components/main-layout";
import { trpc } from "@/trpc/client";
import { formatDate } from "@/utils/time";
import Link from "next/link";

export default function CapTableUploadsPage() {
  const [data] = trpc.capTableUploads.list.useSuspenseQuery();

  const columnHelper = createColumnHelper<(typeof data.uploads)[number]>();
  const columns = [
    columnHelper.accessor("status", {
      header: "Status",
      cell: (info) => (
        <span className="inline-flex rounded-full bg-yellow-100 px-2 text-xs leading-5 font-semibold text-yellow-800">
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor("user", {
      header: "Uploaded by",
      cell: (info) => (
        <div>
          <div className="text-sm text-gray-900">{info.getValue().legalName}</div>
          <a href={`mailto:${info.getValue().email}`} className="text-sm text-blue-600 hover:text-blue-800">
            {info.getValue().email}
          </a>
          <div className="text-sm text-gray-500">{info.row.original.companyName}</div>
        </div>
      ),
    }),
    columnHelper.accessor("uploadedAt", {
      header: "Date",
      cell: (info) => formatDate(info.getValue()),
    }),
    columnHelper.accessor("attachments", {
      header: "Files",
      cell: (info) => (
        <div className="flex flex-col gap-2">
          {info.getValue().map((attachment) => (
            <Link
              key={attachment.key}
              href={`/download/${attachment.key}/${attachment.filename}`}
              download={attachment.filename}
              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              {attachment.filename}
            </Link>
          ))}
        </div>
      ),
    }),
  ];

  const table = useTable({ columns, data: data.uploads });

  return (
    <MainLayout title="Cap table uploads" headerActions={null}>
      <div className="p-4">
        {data.uploads.length === 0 ? (
          <div className="text-center">
            <CheckCircleIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No cap table uploads yet</h3>
          </div>
        ) : (
          <DataTable table={table} />
        )}
      </div>
    </MainLayout>
  );
}
