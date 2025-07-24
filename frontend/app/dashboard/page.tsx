"use client";

import { AlertCircle, ArrowUpRight, CheckCircle2, CircleDollarSign, Clock, TrendingUp } from "lucide-react";
import Link from "next/link";
import React, { useCallback, useMemo } from "react";
import DashboardSkeleton from "@/components/DashboardSkeleton";
import MainLayout from "@/components/layouts/Main";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrentUser } from "@/global";
import { trpc } from "@/trpc/client";
import { formatMoneyFromCents } from "@/utils/formatMoney";

export default function DashboardPage() {
  const user = useCurrentUser();

  const {
    data: monthlyStats,
    isLoading: monthlyStatsLoading,
    error: monthlyStatsError,
  } = trpc.dashboard.monthlyStats.useQuery();
  const {
    data: equityProgress,
    isLoading: equityProgressLoading,
    error: equityProgressError,
  } = trpc.dashboard.equityProgress.useQuery();
  const {
    data: workActivity,
    isLoading: workActivityLoading,
    error: workActivityError,
  } = trpc.dashboard.workActivity.useQuery();

  // Memoized computed values for performance
  const currentMonth = useMemo(() => new Date().toLocaleDateString("en-US", { month: "long" }), []);

  const hasUrgentActions = useMemo(() => (workActivity?.documentsToSign || 0) > 0, [workActivity?.documentsToSign]);

  const isLoading = useMemo(
    () => monthlyStatsLoading || equityProgressLoading || workActivityLoading,
    [monthlyStatsLoading, equityProgressLoading, workActivityLoading],
  );

  const hasError = useMemo(() => {
    // Only show errors for actual server/network failures
    // Most tRPC errors (FORBIDDEN, UNAUTHORIZED, NOT_FOUND) are handled gracefully
    // and the routes return default data (0s) for new users
    const isRealError = (error: unknown) => {
      if (!error || typeof error !== "object") return false;

      // Only show errors for actual server/network issues
      return (
        "code" in error &&
        (error.code === "INTERNAL_SERVER_ERROR" || error.code === "TIMEOUT" || error.code === "NETWORK_ERROR")
      );
    };

    return isRealError(monthlyStatsError) || isRealError(equityProgressError) || isRealError(workActivityError);
  }, [monthlyStatsError, equityProgressError, workActivityError]);

  // Memoized formatted values
  const currentMonthEarnings = useMemo(
    () => formatMoneyFromCents(monthlyStats?.currentMonth.totalAmount || 0),
    [monthlyStats?.currentMonth.totalAmount],
  );

  const earningsDifference = useMemo(() => {
    const current = monthlyStats?.currentMonth.totalAmount || 0;
    const previous = monthlyStats?.previousMonth.totalAmount || 0;
    return formatMoneyFromCents(Math.abs(current - previous));
  }, [monthlyStats?.currentMonth.totalAmount, monthlyStats?.previousMonth.totalAmount]);

  const isEarningsIncrease = useMemo(
    () => (monthlyStats?.currentMonth.totalAmount || 0) > (monthlyStats?.previousMonth.totalAmount || 0),
    [monthlyStats?.currentMonth.totalAmount, monthlyStats?.previousMonth.totalAmount],
  );

  const equityVestedAmount = useMemo(
    () => formatMoneyFromCents(equityProgress?.vestedAmount || 0),
    [equityProgress?.vestedAmount],
  );

  const documentsToSignCount = useMemo(() => workActivity?.documentsToSign || 0, [workActivity?.documentsToSign]);

  const invoicesSubmittedCount = useMemo(() => workActivity?.invoicesSubmitted || 0, [workActivity?.invoicesSubmitted]);

  const hoursLogged = useMemo(() => workActivity?.hoursLogged || 0, [workActivity?.hoursLogged]);

  // Callback for document link
  const handleDocumentLink = useCallback(() => {
    // Analytics or tracking could be added here
  }, []);

  return (
    <MainLayout title="Dashboard">
      <div className="max-w-9xl mx-auto px-4 pt-4 md:px-6 md:pt-8">
        {/* Welcome Header */}
        <div className="mb-8 md:mb-12">
          <h1 className="text-foreground mb-1 text-xl font-semibold md:text-2xl">Welcome back, {user.legalName} 👋</h1>
          <p className="text-muted-foreground text-sm md:text-base">
            Here's your {currentMonth.toLowerCase()} overview
          </p>
        </div>

        {/* Show error state if any query failed */}
        {hasError ? (
          <div className="mb-8 md:mb-10">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Unable to load dashboard data. Please refresh the page or try again later.
              </AlertDescription>
            </Alert>
          </div>
        ) : null}

        {/* Critical Actions Banner - Responsive design */}
        {!isLoading && hasUrgentActions ? (
          <div className="mb-8 md:mb-10">
            <div className="border-border bg-muted w-full rounded-lg border p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <AlertCircle className="text-foreground h-5 w-5 flex-shrink-0" />
                  <div>
                    <h3 className="text-foreground text-sm font-medium md:text-base">Action required</h3>
                    <p className="text-muted-foreground mt-0.5 text-xs md:text-sm">
                      {documentsToSignCount} document{documentsToSignCount > 1 ? "s" : ""} waiting for signature
                    </p>
                  </div>
                </div>
                <Link
                  href="/documents"
                  onClick={handleDocumentLink}
                  className="bg-foreground text-background hover:bg-muted-foreground inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-medium transition-colors sm:w-auto"
                >
                  Review now
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        ) : null}

        {/* Dashboard Cards - Larger 3-column layout */}
        {isLoading ? (
          <DashboardSkeleton />
        ) : (
          <div className="grid gap-6 md:grid-cols-2 md:gap-8 lg:grid-cols-3 lg:gap-10">
            {/* Earnings Card */}
            <Card className="border-border bg-card border p-6 shadow-sm md:p-7">
              <CardHeader className="pb-2 md:pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-foreground text-sm font-medium md:text-base">Earnings</CardTitle>
                  <CircleDollarSign className="text-foreground size-4" />
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2 md:space-y-3">
                  <div className="mb-2 flex items-center gap-2 md:mb-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium md:px-3 md:py-1 ${
                        (monthlyStats?.currentMonth?.totalAmount ?? 0) > 0 && monthlyStats?.paymentStatus === "paid"
                          ? "bg-muted text-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {(monthlyStats?.currentMonth?.totalAmount ?? 0) > 0 && monthlyStats?.paymentStatus === "paid" ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <Clock className="h-3 w-3" />
                      )}
                      {(monthlyStats?.currentMonth?.totalAmount ?? 0) > 0 && monthlyStats?.paymentStatus === "paid"
                        ? "Paid"
                        : "Pending"}
                    </span>
                  </div>
                  <div className="text-foreground text-xl font-bold md:text-2xl">{currentMonthEarnings}</div>
                  <div className="flex items-center gap-2 text-xs md:text-sm">
                    <span
                      className={`inline-flex items-center gap-1 ${
                        isEarningsIncrease ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {isEarningsIncrease ? "↗" : "→"}
                      {earningsDifference}
                    </span>
                    <span className="text-muted-foreground">vs last month</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Equity Card */}
            <Card className="border-border bg-card border p-6 shadow-sm md:p-7">
              <CardHeader className="pb-2 md:pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-foreground text-sm font-medium md:text-base">Equity</CardTitle>
                  <TrendingUp className="text-foreground size-4" />
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2 md:space-y-3">
                  <div className="mb-2 flex items-center gap-2 md:mb-3">
                    {(equityProgress?.recentGrants || 0) > 0 ? (
                      <span className="bg-muted text-foreground inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium md:px-3 md:py-1">
                        <span className="bg-foreground h-1.5 w-1.5 rounded-full"></span>
                        {equityProgress?.recentGrants} new grant{(equityProgress?.recentGrants || 0) > 1 ? "s" : ""}
                      </span>
                    ) : (
                      <span className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium md:px-3 md:py-1">
                        <span className="bg-muted-foreground h-1.5 w-1.5 rounded-full"></span>
                        No new grants
                      </span>
                    )}
                  </div>
                  <div className="text-foreground text-xl font-bold md:text-2xl">
                    {equityProgress?.percentage || 0}%
                  </div>
                  <div className="text-muted-foreground text-xs md:text-sm">{equityVestedAmount} vested</div>
                </div>
              </CardContent>
            </Card>

            {/* Activity Card */}
            <Card className="border-border bg-card border p-6 shadow-sm md:p-7">
              <CardHeader className="pb-2 md:pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-foreground text-sm font-medium md:text-base">Activity</CardTitle>
                  <Clock className="text-foreground size-4" />
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2 md:space-y-3">
                  <div className="mb-2 flex items-center gap-2 md:mb-3">
                    {documentsToSignCount > 0 ? (
                      <span className="bg-muted text-foreground inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium md:px-3 md:py-1">
                        <AlertCircle className="h-3 w-3" />
                        {documentsToSignCount} to sign
                      </span>
                    ) : (
                      <span className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium md:px-3 md:py-1">
                        <CheckCircle2 className="h-3 w-3" />
                        All caught up
                      </span>
                    )}
                  </div>
                  <div className="text-foreground text-xl font-bold md:text-2xl">{hoursLogged}h</div>
                  <div className="text-muted-foreground text-xs md:text-sm">
                    {invoicesSubmittedCount} invoice{invoicesSubmittedCount !== 1 ? "s" : ""} submitted
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Quick Actions - Responsive design */}
        <div className="border-border mt-10 flex flex-col gap-4 border-t pt-8 md:mt-12 md:flex-row md:items-center md:justify-between md:pt-10">
          <div>
            <h3 className="text-foreground mb-1 text-sm font-medium">Quick actions</h3>
            <p className="text-muted-foreground text-xs md:text-sm">Common tasks for this time of month</p>
          </div>
          <div className="flex gap-3">
            {user.roles.worker ? (
              <Link
                href="/invoices/new"
                className="bg-foreground text-background hover:bg-muted-foreground inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-medium transition-colors md:w-auto"
              >
                Create invoice
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
