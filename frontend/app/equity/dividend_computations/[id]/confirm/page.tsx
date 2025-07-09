"use client";

import { Suspense, useState, useEffect } from "react";
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

// Mock data - replace with actual API call
const mockComputation = {
  id: 1,
  total_amount_in_usd: 50000,
  dividends_issuance_date: "2025-01-15",
  return_of_capital: false,
  created_at: "2025-01-10T10:00:00Z",
  confirmed_at: null,
  outputs: [
    {
      id: 1,
      investor_name: "John Doe",
      share_class: "Common",
      number_of_shares: 1000,
      total_amount_in_usd: 5000
    },
    {
      id: 2,
      investor_name: "Jane Smith",
      share_class: "Preferred A",
      number_of_shares: 500,
      total_amount_in_usd: 5000
    }
  ]
};

function ConfirmDividendComputationContent() {
  const params = useParams();
  const router = useRouter();
  const [computation, setComputation] = useState(mockComputation);
  const [isLoading, setIsLoading] = useState(false);
  const totalRecipients = computation.outputs.length;
  const totalShares = computation.outputs.reduce((sum, output) => sum + (output.number_of_shares || 0), 0);

  useEffect(() => {
    // Load computation data from localStorage for demo
    const computationId = parseInt(params.id as string);
    if (isNaN(computationId)) {
      console.error('Invalid computation ID:', params.id);
      return;
    }
    const demoComputations = JSON.parse(localStorage.getItem('demoComputations') || '[]');
    const foundComputation = demoComputations.find((comp: any) => comp.id === computationId);
    
    if (foundComputation) {
      setComputation(foundComputation);
    }
  }, [params.id]);

  const handleConfirm = async () => {
    setIsLoading(true);
    
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Update the computation to confirmed
      const updatedComputation = {
        ...computation,
        confirmed_at: new Date().toISOString()
      };
      
      // Update localStorage
      const demoComputations = JSON.parse(localStorage.getItem('demoComputations') || '[]');
      const updatedComputations = demoComputations.map((comp: any) => 
        comp.id === computation.id ? updatedComputation : comp
      );
      localStorage.setItem('demoComputations', JSON.stringify(updatedComputations));
      
      // Redirect back to detail view
      router.push(`/equity/dividend_computations/${computation.id}`);
      
    } catch (error) {
      console.error('Error confirming computation:', error);
    } finally {
      setIsLoading(false);
    }
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
        <Button onClick={handleConfirm} disabled={isLoading}>
          <CheckCircle className="w-4 h-4 mr-2" />
          {isLoading ? "Confirming..." : "Confirm Computation"}
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