"use client";
import { useParams } from "next/navigation";
import React, { useEffect } from "react";
import { useCurrentCompany } from "@/global";
import { trpc } from "@/trpc/client";
import EditPage from "../../Edit";
import { useLayoutStore } from "@/components/layouts/LayoutStore";

export default function Edit() {
  const company = useCurrentCompany();
  const { id } = useParams<{ id: string }>();
  const [update] = trpc.companyUpdates.get.useSuspenseQuery({ companyId: company.id, id });
  const setTitle = useLayoutStore((state) => state.setTitle);
  const setHeaderActions = useLayoutStore((state) => state.setHeaderActions);
  useEffect(() => {
    setTitle("Edit company update");
    setHeaderActions(null);
  }, [setTitle, setHeaderActions]);
  return <EditPage update={update} />;
}
