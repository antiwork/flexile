"use client";
import { useParams } from "next/navigation";
import React from "react";
import { useCurrentCompany } from "@/global";
import { trpc } from "@/trpc/client";
import EditPage from "../../Edit";

export default function Edit() {
  const company = useCurrentCompany();
  const { id } = useParams<{ id: string }>();
  const [update] = trpc.companyUpdates.get.useSuspenseQuery({ companyId: company.id, id });

  return <EditPage update={update} />;
}
