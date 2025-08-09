"use client";
import { CheckCircle2, Circle, CircleCheck, Plus } from "lucide-react";
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
        <div className="px-6 py-8">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-16 rounded bg-gray-200" />
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
      <div className="mx-6">
        {/* Header row */}
        <div className="grid grid-cols-12 gap-4 border-b border-gray-200 px-4 py-3 text-sm font-medium text-gray-500">
          <div className="col-span-7">Title</div>
          <div className="col-span-3 text-right">Date</div>
          <div className="col-span-2 text-right">Status</div>
        </div>

        {/* Update rows */}
        <div className="divide-y divide-gray-100">
          {updates.map((update) => (
            <div
              key={update.id}
              className="grid cursor-pointer grid-cols-12 items-start gap-4 px-4 py-4 transition-colors hover:bg-gray-50"
              role="button"
              tabIndex={0}
              aria-label={`Open update ${update.title}`}
              onClick={() => handleUpdateClick(update)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleUpdateClick(update);
                }
              }}
            >
              <div className="col-span-7">
                <h3 className="mb-1 text-sm font-medium text-gray-900">{update.title}</h3>
                <p className="line-clamp-2 text-sm text-gray-500">{update.summary}</p>
              </div>
              <div className="col-span-3 text-right text-sm text-gray-500">
                {update.sentAt ? formatDate(update.sentAt) : "—"}
              </div>
              <div className="col-span-2 text-right">
                {update.sentAt ? (
                  <div className="inline-flex items-center gap-1.5 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-gray-900">Sent</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 text-sm">
                    <Circle className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-500">Draft</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {!isAdmin && selectedUpdateId ? (
        <ViewUpdateDialog
          updateId={selectedUpdateId}
          onOpenChange={(open) => {
            if (!open) setSelectedUpdateId(null);
          }}
        />
      ) : null}
    </>
  );
};
