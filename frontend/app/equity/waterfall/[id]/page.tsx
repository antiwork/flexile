"use client";
import { useParams, useRouter } from "next/navigation";
import React, { useEffect } from "react";
import TableSkeleton from "@/components/TableSkeleton";
import EquityLayout from "@/app/equity/Layout";

export default function ScenarioPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  
  // Redirect to playground - it's the primary interface now
  useEffect(() => {
    router.replace(`/equity/waterfall/${id}/playground`);
  }, [id, router]);
  
  // Show loading while redirecting
  return (
    <EquityLayout>
      <TableSkeleton columns={3} />
    </EquityLayout>
  );
}
