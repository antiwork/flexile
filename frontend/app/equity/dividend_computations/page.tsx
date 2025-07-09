"use client";

import { Suspense, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Plus, Eye, CheckCircle, Trash2 } from "lucide-react";
import Link from "next/link";
import EquityLayout from "@/app/equity/Layout";

// Mock data - replace with actual API call
const mockComputations = [
  {
    id: 1,
    total_amount_in_usd: 50000,
    dividends_issuance_date: "2025-01-15",
    return_of_capital: false,
    created_at: "2025-01-10T10:00:00Z",
    confirmed_at: null,
    outputs: []
  },
  {
    id: 2,
    total_amount_in_usd: 75000,
    dividends_issuance_date: "2024-12-01",
    return_of_capital: true,
    created_at: "2024-11-25T14:30:00Z",
    confirmed_at: "2024-11-26T09:15:00Z",
    outputs: []
  }
];

type DividendComputation = typeof mockComputations[0];

const StatusBadge = ({ confirmed_at }: { confirmed_at: string | null }) => {
  if (confirmed_at) {
    return (
      <Badge variant="default" className="bg-green-100 text-green-800">
        <CheckCircle className="w-3 h-3 mr-1" />
        Confirmed
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
      Draft
    </Badge>
  );
};

const columnHelper = createColumnHelper<DividendComputation>();

function DividendComputationsContent() {
  const [computations, setComputations] = useState(mockComputations);

  useEffect(() => {
    // Load demo computations from localStorage
    const demoComputations = JSON.parse(localStorage.getItem('demoComputations') || '[]');
    const allComputations = [...mockComputations, ...demoComputations];
    setComputations(allComputations);
  }, []);

  const handleDelete = (computationId: number) => {
    if (confirm('Are you sure you want to delete this computation?')) {
      // Remove from localStorage (demo data)
      const demoComputations = JSON.parse(localStorage.getItem('demoComputations') || '[]');
      const updatedDemoComputations = demoComputations.filter((comp: any) => comp.id !== computationId);
      localStorage.setItem('demoComputations', JSON.stringify(updatedDemoComputations));

      // Update local state
      const updatedComputations = computations.filter(comp => comp.id !== computationId);
      setComputations(updatedComputations);
    }
  };

  const columns = [
    columnHelper.accessor("dividends_issuance_date", {
      header: "Issuance Date",
      cell: (info) => {
        const date = new Date(info.getValue());
        return format(date, "MMM d, yyyy");
      },
    }),
    columnHelper.accessor("total_amount_in_usd", {
      header: "Total Amount",
      cell: (info) => {
        const amount = info.getValue();
        return `$${amount.toLocaleString()}`; // Display as dollars directly
      },
    }),
    columnHelper.accessor("return_of_capital", {
      header: "Type",
      cell: (info) => {
        const isReturnOfCapital = info.getValue();
        return isReturnOfCapital ? "Return of Capital" : "Dividend";
      },
    }),
    columnHelper.accessor("confirmed_at", {
      header: "Status",
      cell: (info) => {
        return <StatusBadge confirmed_at={info.getValue()} />;
      },
    }),
    columnHelper.display({
      id: "actions",
      header: "Actions",
      cell: (info) => {
        const computation = info.row.original;
        return (
          <div className="flex space-x-2">
            <Link href={`/equity/dividend_computations/${computation.id}`}>
              <Button variant="outline" size="small">
                <Eye className="w-4 h-4 mr-1" />
                View
              </Button>
            </Link>
            {!computation.confirmed_at && (
              <Button
                variant="outline"
                size="small"
                className="text-red-600 hover:bg-red-50"
                onClick={() => handleDelete(computation.id)}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Delete
              </Button>
            )}
          </div>
        );
      },
    }),
  ];

  const table = useTable({ columns, data: computations });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold">Dividend Computations</h1>
          <p className="text-gray-600 mt-1">
            Create and manage dividend distribution calculations
          </p>
        </div>
        <Link href="/equity/dividend_computations/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Computation
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dividend Computations</CardTitle>
          <CardDescription>
            All dividend computation records for your company
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable table={table} />
        </CardContent>
      </Card>
    </div>
  );
}

export default function DividendComputationsPage() {
  return (
    <EquityLayout>
      <Suspense fallback={<div>Loading...</div>}>
        <DividendComputationsContent />
      </Suspense>
    </EquityLayout>
  );
}