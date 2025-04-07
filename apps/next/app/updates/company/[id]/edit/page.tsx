"use client";
import { useParams } from "next/navigation";
import { useCurrentCompany } from "@/global";
import { trpc } from "@/trpc/client";
import EditPage from "../../Edit";
import React from "react";

export default function Edit() {
  const company = useCurrentCompany();
  const { id } = useParams<{ id: string }>();
  const [update] = trpc.companyUpdates.get.useSuspenseQuery({ companyId: company.id, id });

  return <EditPage update={update} />;
}
