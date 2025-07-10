"use client";

import { Suspense, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatMoney } from "@/utils/formatMoney";
import { format } from "date-fns";
import {
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  Users,
  DollarSign,
  Calendar,
  Shield
} from "lucide-react";
import Link from "next/link";
import EquityLayout from "@/app/equity/Layout";
import { trpc } from "@/trpc/client";
import { useCurrentCompany } from "@/global";

type DividendComputationOutput = {
  id: number;
  investor_name: string;
  share_class: string;
  number_of_shares: number;
  total_amount_in_usd: number;
};

type DividendComputation = {
  id: number;
  total_amount_in_usd: number;
  dividends_issuance_date: string;
  return_of_capital: boolean;
  created_at: string;
  confirmed_at: string | null;
  outputs: DividendComputationOutput[];
};

function ConfirmDividendComputationContent() {
  const params = useParams();
  const router = useRouter();
  const company = useCurrentCompany();
  const computationId = parseInt(params.id as string);

  const [computation] = trpc.dividendComputations.get.useSuspenseQuery({
    companyId: company.id,
    id: computationId
  });

  const totalRecipients = computation.outputs.length;
  const totalShares = computation.outputs.reduce((sum, output) => sum + (output.number_of_shares || 0), 0);

  const confirmMutation = trpc.dividendComputations.confirm.useMutation({
    onSuccess: () => {
      router.push(`/equity/dividend_computations/${computationId}`);
    },
  });

  const handleConfirm = () => {
    confirmMutation.mutate({
      companyId: company.id,
      id: computationId
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Link href={`/equity/dividend_computations/${computation.id}`}>
          <Button variant="outline" size="small">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Computation
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">
            Confirm Dividend Computation #{computation.id}
          </h1>
          <p className="text-gray-600 mt-1">
            Review and confirm the dividend computation details
          </p>
        </div>
      </div>

      <Alert className="border-red-200 bg-red-50">
        <AlertTriangle className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-700">
          <strong>Warning:</strong> This action cannot be undone. Once confirmed, dividend records will be created
          and the computation cannot be modified. Please review all details carefully.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-lg">
              <DollarSign className="w-5 h-5 mr-2" />
              Total Amount
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">
              ${computation.total_amount_in_usd.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-lg">
              <Calendar className="w-5 h-5 mr-2" />
              Issuance Date
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">
              {format(new Date(computation.dividends_issuance_date), "MMM d, yyyy")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-lg">
              <Users className="w-5 h-5 mr-2" />
              Recipients
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">
              {totalRecipients}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-lg">
              <Shield className="w-5 h-5 mr-2" />
              Total Shares
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">
              {totalShares.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Computation Summary</CardTitle>
          <CardDescription>
            Final distribution breakdown that will be confirmed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="font-medium">Payment Type:</span>
              <span>{computation.return_of_capital ? "Return of Capital" : "Dividend"}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="font-medium">Total Distribution:</span>
              <span className="font-bold">${computation.total_amount_in_usd.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="font-medium">Number of Recipients:</span>
              <span>{totalRecipients}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="font-medium">Issuance Date:</span>
              <span>{format(new Date(computation.dividends_issuance_date), "MMMM d, yyyy")}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recipient Preview</CardTitle>
          <CardDescription>
            Top recipients in this dividend computation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {computation.outputs.slice(0, 5).map((output) => (
              <div key={output.id} className="flex justify-between items-center py-2 border-b last:border-b-0">
                <div>
                  <p className="font-medium">{output.investor_name}</p>
                  <p className="text-sm text-gray-600">{output.share_class} • {output.number_of_shares?.toLocaleString() || "—"} shares</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">${output.total_amount_in_usd.toLocaleString()}</p>
                </div>
              </div>
            ))}
            {computation.outputs.length > 5 && (
              <p className="text-sm text-gray-600 text-center py-2">
                ... and {computation.outputs.length - 5} more recipients
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What happens when you confirm?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium">Dividend Records Created</p>
                <p className="text-sm text-gray-600">Individual dividend records will be created for each recipient</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium">Dividend Round Established</p>
                <p className="text-sm text-gray-600">A dividend round will be created with status "issued"</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium">Payment Processing Ready</p>
                <p className="text-sm text-gray-600">The dividend round will be marked as ready for payment processing</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end space-x-4">
        <Link href={`/equity/dividend_computations/${computation.id}`}>
          <Button variant="outline">Cancel</Button>
        </Link>
        <Button onClick={handleConfirm} disabled={confirmMutation.isPending}>
          <CheckCircle className="w-4 h-4 mr-2" />
          {confirmMutation.isPending ? "Confirming..." : "Confirm Computation"}
        </Button>
      </div>
    </div>
  );
}

export default function ConfirmDividendComputationPage() {
  return (
    <EquityLayout>
      <Suspense fallback={<div>Loading...</div>}>
        <ConfirmDividendComputationContent />
      </Suspense>
    </EquityLayout>
  );
}
