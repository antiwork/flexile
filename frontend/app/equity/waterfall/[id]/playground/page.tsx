"use client";

import { useParams, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { Save, RotateCcw, Layers, TrendingUp, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { trpc } from "@/trpc/client";
import EquityLayout from "@/app/equity/Layout";
import Placeholder from "@/components/Placeholder";
import TableSkeleton from "@/components/TableSkeleton";
import WaterfallChartPro from "@/components/WaterfallChartPro";
import ExitAmountControl from "@/components/ExitAmountControl";
import { useEquityPlayground } from "@/lib/equity-modeling/store";
import { convertCapTableToPlayground, convertScenarioToPlayground } from "@/lib/equity-modeling/data-adapter";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import { formatDate } from "@/utils/time";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function PlaygroundPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const company = useCurrentCompany();
  const user = useCurrentUser();
  const isAdmin = !!user.roles.administrator;
  const isLawyer = !!user.roles.lawyer;
  
  // Mutations
  const createScenario = trpc.liquidationScenarios.run.useMutation();
  
  const [hoveredPayout, setHoveredPayout] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingDetails, setIsEditingDetails] = useState(false);

  // Zustand store
  const {
    scenario,
    equityStructure,
    payouts,
    isCalculating,
    hasUnsavedChanges,
    setScenario,
    updateExitAmount,
    updateExitDate,
    loadFromBackendData,
    reset,
    markSaved,
    recalculate,
  } = useEquityPlayground();

  // Check authorization
  if (!isAdmin && !isLawyer) {
    return (
      <EquityLayout>
        <Placeholder>You don't have permission to view liquidation scenarios.</Placeholder>
      </EquityLayout>
    );
  }

  // Load scenario data
  const { data: scenarioData, isLoading: scenarioLoading } = trpc.liquidationScenarios.show.useQuery(
    { 
      companyId: company.id,
      scenarioId: id 
    },
    { enabled: !!company.id }
  );

  // Load cap table data for equity structure
  const { data: capTableData, isLoading: capTableLoading } = trpc.capTable.showForWaterfall.useQuery(
    {
      companyId: company.id
    },
    { enabled: !!company.id }
  );

  // Initialize playground when data loads
  useEffect(() => {
    if (scenarioData && capTableData) {
      const playgroundScenario = convertScenarioToPlayground(scenarioData);
      const playgroundEquityStructure = convertCapTableToPlayground(capTableData);
      
      setScenario(playgroundScenario);
      loadFromBackendData(playgroundEquityStructure);
    }
  }, [scenarioData, capTableData, setScenario, loadFromBackendData]);

  // Auto-calculate when data is ready
  useEffect(() => {
    if (equityStructure.investors.length > 0 && !isCalculating) {
      recalculate();
    }
  }, [equityStructure, isCalculating, recalculate]);

  const handleSave = async () => {
    if (!isAdmin) {
      alert('Only administrators can create new scenarios');
      return;
    }

    setIsSaving(true);
    try {
      // Auto-generate new name with version number
      const originalName = scenarioData?.name || 'Scenario';
      const versionNumber = Math.floor(Math.random() * 100) + 1; // Simple versioning
      const newName = `${originalName} v${versionNumber}`;
      
      // Save current scenario with updated values
      const newScenario = await createScenario.mutateAsync({
        companyId: company.id,
        name: newName,
        description: scenario.description || `Modified version of ${originalName}`,
        exitAmountCents: scenario.exitAmountCents,
        exitDate: scenario.exitDate.toISOString(),
      });
      
      // Navigate to the new scenario
      router.push(`/equity/waterfall/${newScenario.externalId}/playground`);
      markSaved();
    } catch (error: any) {
      console.error('Failed to save scenario:', error);
      // Show user-friendly error message
      if (error.message?.includes('FORBIDDEN')) {
        alert('You do not have permission to create scenarios');
      } else if (error.message?.includes('exitAmountCents')) {
        alert('Invalid exit amount. Please check your input.');
      } else {
        alert(`Failed to save scenario: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const isLoading = scenarioLoading || capTableLoading;

  if (isLoading) {
    return (
      <EquityLayout>
        <TableSkeleton columns={3} />
      </EquityLayout>
    );
  }

  if (!scenarioData) {
    return (
      <EquityLayout>
        <Placeholder>Scenario not found.</Placeholder>
      </EquityLayout>
    );
  }

  return (
    <EquityLayout
      headerActions={
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="small" 
            onClick={() => router.push(`/equity/waterfall`)}
          >
            <ArrowLeft className="size-4 mr-2" />
            Back to Scenarios
          </Button>
          <Button 
            variant="outline" 
            size="small" 
            onClick={reset}
            disabled={!hasUnsavedChanges}
          >
            <RotateCcw className="size-4 mr-2" />
            Reset
          </Button>
          <Button 
            size="small" 
            onClick={handleSave}
            disabled={!hasUnsavedChanges || isSaving}
          >
            <Save className="size-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save as New'}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Status bar */}
        {hasUnsavedChanges && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-center gap-2 text-yellow-800">
              <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
              <span className="text-sm font-medium">Unsaved changes</span>
              <span className="text-sm">Your modifications will be lost unless saved</span>
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Controls panel */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="p-6">
              <ExitAmountControl
                exitAmountCents={scenario.exitAmountCents}
                onExitAmountChange={updateExitAmount}
                maxAmount={500_000_000} // $500M max
                disabled={isCalculating}
              />
            </Card>

            {/* Quick stats */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Quick Stats</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Investors</span>
                  <span className="font-medium">{equityStructure.investors.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Share Classes</span>
                  <span className="font-medium">{equityStructure.shareClasses.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Shares</span>
                  <span className="font-medium">
                    {equityStructure.shareHoldings.reduce((sum, h) => sum + h.numberOfShares, 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Recipients</span>
                  <span className="font-medium">{payouts.length}</span>
                </div>
              </div>
            </Card>

            {/* Scenario info */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Scenario Details</h3>
                <Button
                  variant="ghost"
                  size="small"
                  onClick={() => setIsEditingDetails(!isEditingDetails)}
                >
                  {isEditingDetails ? 'Done' : 'Edit'}
                </Button>
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <div className="text-gray-600">Name</div>
                  {isEditingDetails ? (
                    <Input
                      value={scenario.name}
                      onChange={(e) => setScenario({...scenario, name: e.target.value})}
                      className="mt-1"
                    />
                  ) : (
                    <div className="font-medium">{scenario.name}</div>
                  )}
                </div>
                <div>
                  <div className="text-gray-600">Exit Date</div>
                  {isEditingDetails ? (
                    <Input
                      type="date"
                      value={scenario.exitDate.toISOString().split('T')[0]}
                      onChange={(e) => updateExitDate(new Date(e.target.value))}
                      className="mt-1"
                    />
                  ) : (
                    <div className="font-medium">{formatDate(scenario.exitDate)}</div>
                  )}
                </div>
                <div>
                  <div className="text-gray-600">Status</div>
                  <div className="font-medium capitalize">{scenario.status}</div>
                </div>
                <div>
                  <div className="text-gray-600">Description</div>
                  {isEditingDetails ? (
                    <Textarea
                      value={scenario.description}
                      onChange={(e) => setScenario({...scenario, description: e.target.value})}
                      className="mt-1"
                      rows={3}
                    />
                  ) : (
                    <div className="font-medium">{scenario.description || 'No description'}</div>
                  )}
                </div>
              </div>
            </Card>
          </div>

          {/* Visualization panel */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="waterfall" className="space-y-4">
              <TabsList>
                <TabsTrigger value="waterfall" className="flex items-center gap-2">
                  <TrendingUp className="size-4" />
                  Waterfall
                </TabsTrigger>
                <TabsTrigger value="breakdown" className="flex items-center gap-2">
                  <Layers className="size-4" />
                  Breakdown
                </TabsTrigger>
              </TabsList>

              <TabsContent value="waterfall">
                <WaterfallChartPro
                  payouts={payouts}
                  exitAmountCents={scenario.exitAmountCents}
                  onPayoutHover={setHoveredPayout}
                  highlightedPayoutId={hoveredPayout?.id}
                  isCalculating={isCalculating}
                />
              </TabsContent>

              <TabsContent value="breakdown">
                <Card>
                  <div className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Detailed Breakdown</h3>
                    
                    {isCalculating ? (
                      <div className="flex items-center justify-center h-32 text-gray-500">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3" />
                        Calculating...
                      </div>
                    ) : payouts.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <div className="text-lg font-medium">No Payouts</div>
                        <div className="text-sm">Increase exit amount to see distributions</div>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-3 px-2 font-medium text-gray-700">Investor</th>
                              <th className="text-left py-3 px-2 font-medium text-gray-700">Share Class</th>
                              <th className="text-right py-3 px-2 font-medium text-gray-700">Shares</th>
                              <th className="text-right py-3 px-2 font-medium text-gray-700">Preference</th>
                              <th className="text-right py-3 px-2 font-medium text-gray-700">Participation</th>
                              <th className="text-right py-3 px-2 font-medium text-gray-700">Common</th>
                              <th className="text-right py-3 px-2 font-medium text-gray-700">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {payouts.map((payout) => (
                              <tr 
                                key={payout.id} 
                                className={`border-b border-gray-100 hover:bg-gray-50 ${
                                  hoveredPayout?.id === payout.id ? 'bg-blue-50' : ''
                                }`}
                                onMouseEnter={() => setHoveredPayout(payout)}
                                onMouseLeave={() => setHoveredPayout(null)}
                              >
                                <td className="py-3 px-2 font-medium">{payout.investorName}</td>
                                <td className="py-3 px-2 text-gray-600">{payout.shareClassName}</td>
                                <td className="py-3 px-2 text-right">{payout.numberOfShares.toLocaleString()}</td>
                                <td className="py-3 px-2 text-right">
                                  {formatMoneyFromCents(payout.liquidationPreferenceAmount)}
                                </td>
                                <td className="py-3 px-2 text-right">
                                  {formatMoneyFromCents(payout.participationAmount)}
                                </td>
                                <td className="py-3 px-2 text-right">
                                  {formatMoneyFromCents(payout.commonProceedsAmount)}
                                </td>
                                <td className="py-3 px-2 text-right font-semibold">
                                  {formatMoneyFromCents(payout.payoutAmountCents)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </EquityLayout>
  );
}