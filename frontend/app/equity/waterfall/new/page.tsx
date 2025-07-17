"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import TableSkeleton from "@/components/TableSkeleton";
import EquityLayout from "@/app/equity/Layout";

export default function NewScenarioRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/equity/waterfall/playground");
  }, [router]);

  return (
    <EquityLayout>
      <TableSkeleton columns={3} />
    </EquityLayout>
  );
}
