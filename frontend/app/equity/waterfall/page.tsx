"use client";
import { Plus, Download } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useMemo } from "react";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import TableSkeleton from "@/components/TableSkeleton";
import { Button } from "@/components/ui/button";
import { useCurrentCompany, useCurrentUser } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import { formatDate } from "@/utils/time";
// import { export_company_liquidation_scenarios_path } from "@/utils/routes";
import EquityLayout from "@/app/equity/Layout";

 type Scenario = RouterOutput["liquidationScenarios"]["list"][number];
 const columnHelper = createColumnHelper<Scenario>();

 export default function Waterfall() {
   const company = useCurrentCompany();
   const user = useCurrentUser();
   const router = useRouter();
   const isAdmin = !!user.roles.administrator;
  const { data = [], isLoading } = trpc.liquidationScenarios.list.useQuery(
    { companyId: company.id },
    { enabled: !!company.id }
  );
  
  // Redirect to new playground when no scenarios exist
  React.useEffect(() => {
    if (!isLoading && data.length === 0) {
      router.replace('/equity/waterfall/new/playground');
    }
  }, [isLoading, data.length, router]);

   const columns = useMemo(
     () => [
       columnHelper.accessor("name", { header: "Name", cell: (info) => <strong>{info.getValue()}</strong> }),
       columnHelper.simple("exitAmountCents", "Exit amount", formatMoneyFromCents, "numeric"),
       columnHelper.simple("exitDate", "Exit date", formatDate),
       columnHelper.simple("status", "Status"),
       columnHelper.simple("createdAt", "Created", formatDate),
     ],
     [],
   );

   const table = useTable({ data, columns });

   return (
     <EquityLayout
       headerActions={
         <div className="flex gap-2">
           <Button variant="outline" size="small" asChild>
             <a href="#">
               <Download className="size-4" />
               Download CSV
             </a>
           </Button>
          {isAdmin && (
            <Button size="small" asChild>
              <Link href="/equity/waterfall/new/playground">
                <Plus className="size-4" />
                New scenario
              </Link>
            </Button>
          )}
         </div>
       }
     >
       {isLoading ? (
         <TableSkeleton columns={5} />
       ) : (
         <DataTable table={table} onRowClicked={(row) => router.push(`/equity/waterfall/${row.id}/playground`)} />
       )}
     </EquityLayout>
   );
 }
