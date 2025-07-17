"use client";

import React, { useEffect, useState } from "react";
import { RotateCcw, Layers, TrendingUp } from "lucide-react";
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
import { convertCapTableToPlayground } from "@/lib/equity-modeling/data-adapter";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import { formatDate } from "@/utils/time";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function PlaygroundPage() {
  const company = useCurrentCompany();
  const user = useCurrentUser();
  const isAdmin = !!user.roles.administrator;
  const isLawyer = !!user.roles.lawyer;

  const [hoveredPayout, setHoveredPayout] = useState<any>(null);
  const [isEditingDetails, setIsEditingDetails] = useState(false);

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
    recalculate,
  } = useEquityPlayground();

  if (!isAdmin && !isLawyer) {
    return (
      <EquityLayout>
        <Placeholder>You don't have permission to view liquidation scenarios.</Placeholder>
      </EquityLayout>
    );
  }

  const { data: capTableData, isLoading: capTableLoading } = trpc.capTable.showForWaterfall.useQuery(
    { companyId: company.id },
    { enabled: !!company.id }
  );

  useEffect(() => {
    if (capTableData) {
      const playgroundEquityStructure = convertCapTableToPlayground(capTableData);
      setScenario({
        id: 'playground',
        name: 'Playground Scenario',
        description: '',
        exitAmountCents: BigInt(0),
        exitDate: new Date(),
        status: 'draft' as const,
      });
      loadFromBackendData(playgroundEquityStructure);
    }
  }, [capTableData, setScenario, loadFromBackendData]);

  useEffect(() => {
    if (equityStructure.investors.length > 0 && !isCalculating) {
      recalculate();
    }
  }, [equityStructure, isCalculating, recalculate]);

  if (capTableLoading) {
    return (
      <EquityLayout>
        <TableSkeleton columns={3} />
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
            onClick={reset}
            disabled={!hasUnsavedChanges}
          >
            <RotateCcw className="size-4 mr-2" />
            Reset
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {hasUnsavedChanges && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-center gap-2 text-yellow-800">
              <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
              <span className="text-sm font-medium">Unsaved changes</span>
              <span className="text-sm">Use reset to revert to original data</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <Card className="p-6">
              <ExitAmountControl
                exitAmountCents={scenario.exitAmountCents}
                onExitAmountChange={updateExitAmount}
                maxAmount={500_000_000}
                disabled={isCalculating}
              />
            </Card>

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
                      onChange={(e) => setScenario({ ...scenario, name: e.target.value })}
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
                      onChange={(e) => setScenario({ ...scenario, description: e.target.value })}
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
