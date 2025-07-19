"use client";
import { useParams } from "next/navigation";
import React from "react";
import { useCurrentCompany } from "@/global";
import { trpc } from "@/trpc/client";
import EditPage from "@/app/(dashboard)/updates/company/Edit";
import { DashboardHeader } from "@/components/DashboardHeader";

export default function Edit() {
  const company = useCurrentCompany();
  const { id } = useParams<{ id: string }>();
  const [update] = trpc.companyUpdates.get.useSuspenseQuery({ companyId: company.id, id });

  return (
    <>
      <DashboardHeader title="Edit company update" />

      <EditPage update={update} />
    </>
  );
}
