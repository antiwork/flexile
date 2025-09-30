"use client";
import { getFilteredRowModel, getSortedRowModel } from "@tanstack/react-table";
import { LinkIcon, Plus, Users } from "lucide-react";
import Link from "next/link";
import React, { useMemo, useState } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import Placeholder from "@/components/Placeholder";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useCurrentCompany } from "@/global";
import { countries } from "@/models/constants";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { formatDate, serverDateToLocal } from "@/utils/time";
import { useIsMobile } from "@/utils/use-mobile";
import InviteLinkModal from "./InviteLinkModal";
import InviteModal from "./InviteModal";

const getStatusLabel = (contractor: RouterOutput["contractors"]["list"][number]) => {
  const { endedAt, startedAt, user } = contractor;
  if (endedAt) {
    return `Ended on ${formatDate(serverDateToLocal(endedAt))}`;
  } else if (startedAt <= new Date()) {
    return `Started on ${formatDate(serverDateToLocal(startedAt))}`;
  } else if (user.onboardingCompleted) {
    return `Starts on ${formatDate(serverDateToLocal(startedAt))}`;
  } else if (user.invitationAcceptedAt) {
    return "In Progress";
  }
  return "Invited";
};

export default function PeoplePage() {
  const company = useCurrentCompany();
  const { data: workers = [], isLoading } = trpc.contractors.list.useQuery({ companyId: company.id });
  const isMobile = useIsMobile();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showInviteLinkModal, setShowInviteLinkModal] = useState(false);

  const columnHelper = createColumnHelper<(typeof workers)[number]>();
  const desktopColumns = useMemo(
    () => [
      columnHelper.accessor("user.name", {
        id: "userName",
        header: "Name",
        cell: (info) => {
          const content = info.getValue();
          return (
            <Link href={`/people/${info.row.original.user.id}`} className="after:absolute after:inset-0">
              {content}
            </Link>
          );
        },
      }),
      columnHelper.accessor("role", {
        header: "Role",
        cell: (info) => info.getValue() || "N/A",
        meta: { filterOptions: [...new Set(workers.map((worker) => worker.role))] },
      }),
      columnHelper.simple("user.countryCode", "Country", (v) => v && countries.get(v)),
      columnHelper.accessor((row) => (row.endedAt ? "Alumni" : row.startedAt > new Date() ? "Onboarding" : "Active"), {
        id: "status",
        header: "Status",
        meta: { filterOptions: ["Active", "Onboarding", "Alumni"] },
        cell: (info) => getStatusLabel(info.row.original),
      }),
    ],
    [workers],
  );
  const mobileColumns = useMemo(
    () => [
      columnHelper.display({
        id: "nameRoleCountry",
        cell: (info) => {
          const person = info.row.original;
          return (
            <>
              <div>
                <div className="truncate text-base font-medium">{person.user.name}</div>
                <div className="truncate text-sm font-normal">{person.role}</div>
              </div>
              {person.user.countryCode ? (
                <div className="text-muted-foreground truncate text-sm font-normal">
                  {countries.get(person.user.countryCode)}
                </div>
              ) : null}
            </>
          );
        },
        meta: {
          cellClassName: "max-w-[50vw]",
        },
      }),

      columnHelper.display({
        id: "statusDisplay",
        cell: (info) => (
          <div className="flex h-full flex-col items-end justify-between">
            <div className="flex h-5 items-center justify-center">{getStatusLabel(info.row.original)}</div>
          </div>
        ),
      }),

      columnHelper.accessor((row) => (row.endedAt ? "Alumni" : row.startedAt > new Date() ? "Onboarding" : "Active"), {
        id: "status",
        header: "Status",
        meta: {
          filterOptions: ["Active", "Onboarding", "Alumni"],
          hidden: true,
        },
      }),

      columnHelper.accessor("user.name", {
        id: "userName",
        header: "Name",
        meta: {
          hidden: true,
        },
      }),

      columnHelper.accessor("role", {
        id: "role",
        header: "Role",
        meta: {
          filterOptions: [...new Set(workers.map((worker) => worker.role))],
          hidden: true,
        },
      }),
    ],
    [workers],
  );

  const columns = isMobile ? mobileColumns : desktopColumns;

  const table = useTable({
    columns,
    data: workers,
    initialState: {
      sorting: [{ id: "status", desc: false }],
    },
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <>
      <DashboardHeader
        title="People"
        headerActions={
          <>
            {isMobile && table.options.enableRowSelection ? (
              <button className="text-link" onClick={() => table.toggleAllRowsSelected(!table.getIsAllRowsSelected())}>
                {table.getIsAllRowsSelected() ? "Unselect all" : "Select all"}
              </button>
            ) : null}
            {workers.length === 0 && !isLoading && (
              <ActionPanel
                openInvite={() => setShowInviteModal(true)}
                openInviteLink={() => setShowInviteLinkModal(true)}
              />
            )}
          </>
        }
      />

      {workers.length > 0 || isLoading ? (
        <DataTable
          table={table}
          searchColumn="userName"
          tabsColumn="status"
          actions={
            <ActionPanel
              openInvite={() => setShowInviteModal(true)}
              openInviteLink={() => setShowInviteLinkModal(true)}
            />
          }
          isLoading={isLoading}
        />
      ) : (
        <div className="mx-4">
          <Placeholder icon={Users}>Contractors will show up here.</Placeholder>
        </div>
      )}

      <InviteModal open={showInviteModal} onOpenChange={setShowInviteModal} />
      <InviteLinkModal open={showInviteLinkModal} onOpenChange={setShowInviteLinkModal} />
    </>
  );
}

const ActionPanel = ({ openInvite, openInviteLink }: { openInvite: () => void; openInviteLink: () => void }) => {
  const isMobile = useIsMobile();

  return isMobile ? (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="floating-action">
          <Plus />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Invite people to your workspace</DialogTitle>
        <DialogDescription className="sr-only">Invite people to your workspace</DialogDescription>
        <div className="flex flex-col gap-3">
          <Button size="small" variant="outline" onClick={openInviteLink}>
            <LinkIcon className="size-4" /> Invite link
          </Button>
          <Button size="small" onClick={openInvite}>
            <Plus className="size-4" /> Add contractor
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  ) : (
    <div className="flex flex-row gap-2">
      <Button size="small" variant="outline" onClick={openInviteLink}>
        <LinkIcon className="size-4" /> Invite link
      </Button>
      <Button size="small" onClick={openInvite}>
        <Plus className="size-4" /> Add contractor
      </Button>
    </div>
  );
};
