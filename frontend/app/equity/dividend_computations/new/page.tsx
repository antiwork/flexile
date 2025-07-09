"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
// import DatePicker from "@/components/DatePicker";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Calculator, DollarSign, Calendar, Info, AlertTriangle } from "lucide-react";
import Link from "next/link";
import EquityLayout from "@/app/equity/Layout";

function NewDividendComputationContent() {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [returnOfCapital, setReturnOfCapital] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      // Demo environment - simulate creation and redirect
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      
      // Validate amount
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        setError('Please enter a valid amount greater than 0');
        return;
      }
      
      // Generate a unique demo ID based on timestamp to avoid collisions
      const existingComputations = JSON.parse(localStorage.getItem('demoComputations') || '[]');
      const existingIds = new Set(existingComputations.map((comp: any) => comp.id));
      let demoId: number;
      do {
        demoId = Date.now() % 100000 + Math.floor(Math.random() * 1000);
      } while (existingIds.has(demoId));
      
      // Store demo data in localStorage for the demo
      const demoComputation = {
        id: demoId,
        total_amount_in_usd: parsedAmount,
        dividends_issuance_date: date,
        return_of_capital: returnOfCapital,
        created_at: new Date().toISOString(),
        confirmed_at: null,
        outputs: [
          {
            id: 1,
            investor_name: "Demo Investor A",
            share_class: "Common",
            number_of_shares: 1000,
            preferred_dividend_amount_in_usd: 0,
            dividend_amount_in_usd: parsedAmount * 0.4,
            qualified_dividend_amount_usd: parsedAmount * 0.4,
            total_amount_in_usd: parsedAmount * 0.4
          },
          {
            id: 2,
            investor_name: "Demo Investor B",
            share_class: "Preferred A",
            number_of_shares: 500,
            preferred_dividend_amount_in_usd: parsedAmount * 0.2,
            dividend_amount_in_usd: parsedAmount * 0.4,
            qualified_dividend_amount_usd: parsedAmount * 0.5,
            total_amount_in_usd: parsedAmount * 0.6
          }
        ]
      };
      
      // Store in localStorage for demo purposes
      existingComputations.push(demoComputation);
      localStorage.setItem('demoComputations', JSON.stringify(existingComputations));
      
      // Redirect to the new computation
      router.push(`/equity/dividend_computations/${demoId}`);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create computation');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Link href="/equity/dividend_computations">
          <Button variant="outline" size="small">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Computations
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">New Dividend Computation</h1>
          <p className="text-gray-600 mt-1">
            Create a new dividend distribution calculation
          </p>
        </div>
      </div>

      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-700">
            {error}
          </AlertDescription>
        </Alert>
      )}

      <form className="space-y-6" onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calculator className="w-5 h-5 mr-2" />
              Computation Details
            </CardTitle>
            <CardDescription>
              Enter the parameters for your dividend computation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="amount">Total Dividend Amount (USD)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="amount"
                    name="amount_in_usd"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="pl-10"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>
                <p className="text-sm text-gray-500">
                  Total amount to be distributed as dividends
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="issuance_date">Dividend Issuance Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="issuance_date"
                    name="dividends_issuance_date"
                    type="date"
                    className="pl-10"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>
                <p className="text-sm text-gray-500">
                  Date when dividends will be issued to shareholders
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="return_of_capital" 
                  name="return_of_capital"
                  checked={returnOfCapital}
                  onCheckedChange={(checked) => setReturnOfCapital(!!checked)}
                />
                <Label htmlFor="return_of_capital" className="font-medium">
                  Return of Capital
                </Label>
              </div>
              <p className="text-sm text-gray-500 ml-6">
                Check this if the payment is a return of capital rather than a dividend
              </p>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                This computation will calculate dividend distributions based on your company's
                current shareholdings and investment structure. The calculation considers
                preferred dividend rates, holding periods, and qualified dividend requirements.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Computation Preview</CardTitle>
            <CardDescription>
              Review the calculation parameters before creating
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Total Amount:</span>
                  <p className="text-lg font-semibold">
                    ${amount ? parseFloat(amount).toLocaleString() : "0.00"}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Issuance Date:</span>
                  <p className="text-lg font-semibold">
                    {date ? new Date(date).toLocaleDateString() : "Not selected"}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Type:</span>
                  <p className="text-lg font-semibold">
                    {returnOfCapital ? "Return of Capital" : "Dividend"}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end space-x-4">
          <Link href="/equity/dividend_computations">
            <Button variant="outline">Cancel</Button>
          </Link>
          <Button type="submit" disabled={isLoading}>
            <Calculator className="w-4 h-4 mr-2" />
            {isLoading ? "Creating..." : "Create Computation"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function NewDividendComputationPage() {
  return (
    <EquityLayout>
      <Suspense fallback={<div>Loading...</div>}>
        <NewDividendComputationContent />
      </Suspense>
    </EquityLayout>
  );
}