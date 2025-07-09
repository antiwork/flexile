"use client";

import { Suspense, useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatMoney } from "@/utils/formatMoney";
import { format } from "date-fns";
import {
  ArrowLeft,
  CheckCircle,
  Download,
  AlertTriangle,
  Users,
  DollarSign,
  Calendar,
  FileText
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
      preferred_dividend_amount_in_usd: 0,
      dividend_amount_in_usd: 5000,
      qualified_dividend_amount_usd: 5000,
      total_amount_in_usd: 5000
    },
    {
      id: 2,
      investor_name: "Jane Smith",
      share_class: "Preferred A",
      number_of_shares: 500,
      preferred_dividend_amount_in_usd: 2000,
      dividend_amount_in_usd: 3000,
      qualified_dividend_amount_usd: 4500,
      total_amount_in_usd: 5000
    }
  ]
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

function DividendComputationDetailContent() {
  const params = useParams();
  const [computation, setComputation] = useState(mockComputation);
  const [isLoading, setIsLoading] = useState(false);
  const isConfirmed = !!computation.confirmed_at;

  useEffect(() => {
    // Load computation data from localStorage for demo
    const computationId = parseInt(params.id as string);
    const demoComputations = JSON.parse(localStorage.getItem('demoComputations') || '[]');
    const foundComputation = demoComputations.find((comp: any) => comp.id === computationId);
    
    if (foundComputation) {
      setComputation(foundComputation);
    }
  }, [params.id]);

  const handleConfirm = async () => {
    if (confirm('Are you sure you want to confirm this computation? This action cannot be undone.')) {
      setIsLoading(true);
      
      try {
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
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
        
        // Update local state
        setComputation(updatedComputation);
        
      } catch (error) {
        console.error('Error confirming computation:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this computation?')) {
      // Remove from localStorage
      const demoComputations = JSON.parse(localStorage.getItem('demoComputations') || '[]');
      const updatedComputations = demoComputations.filter((comp: any) => comp.id !== computation.id);
      localStorage.setItem('demoComputations', JSON.stringify(updatedComputations));
      
      // Redirect back to list
      window.location.href = '/equity/dividend_computations';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/equity/dividend_computations">
            <Button variant="outline" size="small">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Computations
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold">
              Dividend Computation #{computation.id}
            </h1>
            <p className="text-gray-600 mt-1">
              Created {format(new Date(computation.created_at), "MMM d, yyyy 'at' h:mm a")}
            </p>
          </div>
        </div>
        <StatusBadge confirmed_at={computation.confirmed_at} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-lg">
              <DollarSign className="w-5 h-5 mr-2" />
              Total Amount
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
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
            <p className="text-2xl font-bold">
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
            <p className="text-2xl font-bold">
              {computation.outputs.length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Computation Details</CardTitle>
          <CardDescription>
            Distribution breakdown by investor and share class
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Investor</th>
                  <th className="text-left py-3 px-4">Share Class</th>
                  <th className="text-right py-3 px-4">Shares</th>
                  <th className="text-right py-3 px-4">Preferred</th>
                  <th className="text-right py-3 px-4">Common</th>
                  <th className="text-right py-3 px-4">Qualified</th>
                  <th className="text-right py-3 px-4">Total</th>
                </tr>
              </thead>
              <tbody>
                {computation.outputs.map((output) => (
                  <tr key={output.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium">{output.investor_name}</td>
                    <td className="py-3 px-4">{output.share_class}</td>
                    <td className="py-3 px-4 text-right">{output.number_of_shares?.toLocaleString() || "—"}</td>
                    <td className="py-3 px-4 text-right">
                      ${output.preferred_dividend_amount_in_usd.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      ${output.dividend_amount_in_usd.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      ${output.qualified_dividend_amount_usd.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold">
                      ${output.total_amount_in_usd.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Export Options</CardTitle>
          <CardDescription>
            Download computation data in various formats
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-4">
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Download CSV
            </Button>
            <Button variant="outline">
              <FileText className="w-4 h-4 mr-2" />
              Per Investor CSV
            </Button>
            <Button variant="outline">
              <FileText className="w-4 h-4 mr-2" />
              Final CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {!isConfirmed && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center text-yellow-800">
              <AlertTriangle className="w-5 h-5 mr-2" />
              Confirm Computation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                This computation is still in draft mode. Once confirmed, dividend records will be created
                and the computation cannot be modified. Please review all details carefully before confirming.
              </AlertDescription>
            </Alert>
            <div className="mt-4 flex space-x-4">
              <Button onClick={handleConfirm} disabled={isLoading}>
                <CheckCircle className="w-4 h-4 mr-2" />
                {isLoading ? "Confirming..." : "Confirm Computation"}
              </Button>
              <Button variant="outline" className="text-red-600" onClick={handleDelete}>
                Delete Computation
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isConfirmed && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center text-green-800">
              <CheckCircle className="w-5 h-5 mr-2" />
              Computation Confirmed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-green-700">
              This computation was confirmed on {format(new Date(computation.confirmed_at!), "MMM d, yyyy 'at' h:mm a")}.
              Dividend records have been created and payments can now be processed.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function DividendComputationDetailPage() {
  return (
    <EquityLayout>
      <Suspense fallback={<div>Loading...</div>}>
        <DividendComputationDetailContent />
      </Suspense>
    </EquityLayout>
  );
}