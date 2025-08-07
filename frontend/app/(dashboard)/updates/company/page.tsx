"use client";
import { CircleCheck, Plus } from "lucide-react";
import React, { useState } from "react";
import CompanyUpdateModal from "@/app/(dashboard)/updates/company/CompanyUpdateModal";
import ViewUpdateDialog from "@/app/(dashboard)/updates/company/ViewUpdateDialog";
import { DashboardHeader } from "@/components/DashboardHeader";
import Placeholder from "@/components/Placeholder";
import { Button } from "@/components/ui/button";
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

  const handleEditUpdate = (updateId: string) => {
    setEditingUpdateId(updateId);
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
        <div className="px-4 py-8">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-20 rounded bg-gray-200" />
              </div>
            ))}
          </div>
        </div>
      ) : updates.length ? (
        <UpdatesList updates={updates} onEditUpdate={handleEditUpdate} isAdmin={user.roles.administrator} />
      ) : (
        <div className="mx-4">
          <Placeholder icon={CircleCheck}>No updates to display.</Placeholder>
        </div>
      )}

      <CompanyUpdateModal open={showModal} onClose={handleCloseModal} updateId={editingUpdateId} />
    </>
  );
}

const UpdatesList = ({
  updates,
  onEditUpdate,
  isAdmin,
}: {
  updates: UpdateListItem[];
  onEditUpdate: (updateId: string) => void;
  isAdmin: boolean;
}) => {
  const [selectedUpdateId, setSelectedUpdateId] = useState<string | null>(null);

  const handleUpdateClick = (update: UpdateListItem) => {
    if (isAdmin) {
      onEditUpdate(update.id);
    } else {
      setSelectedUpdateId(update.id);
    }
  };

  return (
    <>
      <div className="divide-y">
        {updates.map((update) => (
          <div
            key={update.id}
            className="flex cursor-pointer items-start justify-between px-4 py-4 transition-colors hover:bg-gray-50"
            onClick={() => handleUpdateClick(update)}
          >
            <div className="min-w-0 flex-1 pr-4">
              <div className="mb-1 flex items-center gap-2">
                <h3 className="truncate text-sm font-semibold text-gray-900">{update.title}</h3>
                {update.sentAt ? (
                  <span className="inline-flex items-center rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                    Sent
                  </span>
                ) : null}
              </div>
              <p className="line-clamp-2 text-sm text-gray-600">{update.summary}</p>
            </div>
            <div className="text-sm whitespace-nowrap text-gray-500">
              {update.sentAt ? formatDate(update.sentAt) : "Draft"}
            </div>
          </div>
        ))}
      </div>

      {!isAdmin && selectedUpdateId ? (
        <ViewUpdateDialog updateId={selectedUpdateId} onOpenChange={() => setSelectedUpdateId(null)} />
      ) : null}
    </>
  );
};
