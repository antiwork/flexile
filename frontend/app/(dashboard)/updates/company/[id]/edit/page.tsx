"use client";
import { useParams } from "next/navigation";
import React from "react";
import EditPage from "@/app/(dashboard)/updates/company/Edit";
import { useCurrentCompany } from "@/global";
import { trpc } from "@/trpc/client";

export default function Edit() {
  const company = useCurrentCompany();
  const { id } = useParams<{ id: string }>();
  const [update] = trpc.companyUpdates.get.useSuspenseQuery({ companyId: company.id, id });

  return <EditPage update={update} />;
}
