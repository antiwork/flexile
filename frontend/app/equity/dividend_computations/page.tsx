"use client";

import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Plus, Eye, CheckCircle, Trash2 } from "lucide-react";
import Link from "next/link";
import EquityLayout from "@/app/equity/Layout";
import { trpc } from "@/trpc/client";
import { useCurrentCompany } from "@/global";

type DividendComputation = {
  id: number;
  total_amount_in_usd: number;
  dividends_issuance_date: string;
  return_of_capital: boolean;
  created_at: string;
  confirmed_at: string | null;
  outputs: any[];
};

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

function DividendComputationsContent() {
  const company = useCurrentCompany();
  const [computations, { refetch }] = trpc.dividendComputations.list.useSuspenseQuery(
    { companyId: company.id }
  );

  const deleteMutation = trpc.dividendComputations.delete.useMutation({
    onSuccess: () => {
      void refetch();
    },
  });

  const handleDelete = (computationId: number) => {
    if (typeof window !== 'undefined' && confirm('Are you sure you want to delete this computation? This action cannot be undone.')) {
      deleteMutation.mutate({
        companyId: company.id,
        id: computationId
      });
    }
  };

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
          {computations.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Issuance Date</th>
                    <th className="text-left py-3 px-4">Total Amount</th>
                    <th className="text-left py-3 px-4">Type</th>
                    <th className="text-left py-3 px-4">Status</th>
                    <th className="text-left py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {computations.map((computation: DividendComputation) => (
                    <tr key={computation.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        {format(new Date(computation.dividends_issuance_date), "MMM d, yyyy")}
                      </td>
                      <td className="py-3 px-4">
                        ${computation.total_amount_in_usd.toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        {computation.return_of_capital ? "Return of Capital" : "Dividend"}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge confirmed_at={computation.confirmed_at} />
                      </td>
                      <td className="py-3 px-4">
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
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              Delete
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No dividend computations found. Create your first computation to get started.
            </div>
          )}
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