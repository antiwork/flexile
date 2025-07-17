"use client";

import React, { useState } from "react";
import { Save, Download, RotateCcw, ArrowLeft, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useCurrentCompany, useCurrentUser } from "@/global";
import EquityLayout from "@/app/equity/Layout";
import Placeholder from "@/components/Placeholder";
import WaterfallChartPro from "@/components/WaterfallChartPro";
import { usePlayground } from "@/lib/equity-modeling/store";
import { formatMoneyFromCents } from "@/utils/formatMoney";

export default function WaterfallPlaygroundPage() {
  const company = useCurrentCompany();
  const user = useCurrentUser();
  const isAdmin = !!user.roles.administrator;
  const isLawyer = !!user.roles.lawyer;
  
  const [hoveredPayout, setHoveredPayout] = useState<any>(null);
  
  // Playground state
  const {
    investors,
    shareClasses,
    shareHoldings,
    convertibleSecurities,
    scenario,
    payouts,
    isCalculating,
    hasUnsavedChanges,
    activeTab,
    updateExitAmount,
    updateScenario,
    resetToDefaults,
    exportConfiguration,
    setActiveTab,
  } = usePlayground();

  // Check authorization
  if (!isAdmin && !isLawyer) {
    return (
      <EquityLayout>
        <Placeholder>You don't have permission to access the waterfall playground.</Placeholder>
      </EquityLayout>
    );
  }

  const handleExport = () => {
    const config = exportConfiguration();
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `waterfall-scenario-${scenario.name.replace(/\s+/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <EquityLayout
      headerActions={
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="small" 
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="size-4 mr-2" />
            Back
          </Button>
          <Button 
            variant="outline" 
            size="small" 
            onClick={resetToDefaults}
            disabled={!hasUnsavedChanges}
          >
            <RotateCcw className="size-4 mr-2" />
            Reset
          </Button>
          <Button 
            variant="outline" 
            size="small" 
            onClick={handleExport}
          >
            <Download className="size-4 mr-2" />
            Export
          </Button>
          <Button 
            size="small" 
            disabled={!hasUnsavedChanges}
          >
            <Save className="size-4 mr-2" />
            Save Configuration
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
              <span className="text-sm">Your configuration will be lost unless saved</span>
            </div>
          </div>
        )}

        {/* Page Header */}
        <div className="border-b border-gray-200 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Waterfall Playground</h1>
              <p className="text-gray-600">Configure all cap table terms and model liquidation scenarios</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="small">
                <HelpCircle className="size-4 mr-2" />
                Guide
              </Button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('configuration')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'configuration'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Configuration
            </button>
            <button
              onClick={() => setActiveTab('visualization')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'visualization'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Visualization
            </button>
          </nav>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Configuration Panel */}
          <div className="lg:col-span-4 space-y-6">
            {/* Scenario Settings */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Scenario Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Scenario Name
                  </label>
                  <input
                    type="text"
                    value={scenario.name}
                    onChange={(e) => updateScenario({ name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Exit Amount
                  </label>
                  <input
                    type="number"
                    value={Number(scenario.exitAmountCents) / 100}
                    onChange={(e) => updateExitAmount(BigInt(Math.round(Number(e.target.value) * 100)))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="100000"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Current: {formatMoneyFromCents(Number(scenario.exitAmountCents))}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Exit Date
                  </label>
                  <input
                    type="date"
                    value={scenario.exitDate.toISOString().split('T')[0]}
                    onChange={(e) => updateScenario({ exitDate: new Date(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={scenario.description || ''}
                    onChange={(e) => updateScenario({ description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                    placeholder="Describe this scenario..."
                  />
                </div>
              </div>
            </Card>

            {/* Quick Stats */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Quick Stats</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{investors.length}</div>
                  <div className="text-sm text-gray-500">Investors</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{shareClasses.length}</div>
                  <div className="text-sm text-gray-500">Share Classes</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{shareHoldings.length}</div>
                  <div className="text-sm text-gray-500">Holdings</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{convertibleSecurities.length}</div>
                  <div className="text-sm text-gray-500">Convertibles</div>
                </div>
              </div>
            </Card>

            {/* Placeholder for configuration panels */}
            <Card className="p-6">
              <div className="text-center text-gray-500 py-8">
                <p className="text-sm mb-2">Configuration panels coming soon:</p>
                <div className="text-xs space-y-1">
                  <p>• Investor Management</p>
                  <p>• Share Class Configuration</p>
                  <p>• Convertible Securities</p>
                  <p>• Holdings Editor</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Visualization Panel */}
          <div className="lg:col-span-8">
            <Card className="p-6">
              <div className="space-y-6">
                {/* Waterfall Chart */}
                <div>
                  <WaterfallChartPro
                    payouts={payouts}
                    exitAmountCents={scenario.exitAmountCents}
                    onPayoutHover={setHoveredPayout}
                    highlightedPayoutId={hoveredPayout?.id}
                    isCalculating={isCalculating}
                  />
                </div>

                {/* Detailed Breakdown */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Detailed Breakdown</h3>
                  
                  {isCalculating ? (
                    <div className="flex items-center justify-center h-32 text-gray-500">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3" />
                      Calculating...
                    </div>
                  ) : payouts.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <div className="text-lg font-medium">No Payouts</div>
                      <div className="text-sm">Configure your cap table to see distributions</div>
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
              </div>
            </Card>
          </div>
        </div>
      </div>
    </EquityLayout>
  );
}