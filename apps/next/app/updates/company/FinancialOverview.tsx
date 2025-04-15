import { addMonths, format, parseISO } from "date-fns";
import Delta from "@/components/Delta";
import { Card, CardRow } from "@/components/ui/card";
import type { RouterOutput } from "@/trpc";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import { formatMonth } from "@/utils/time";

type Update = RouterOutput["companyUpdates"]["get"];
type Period = NonNullable<Update["period"]>;
export default function FinancialOverview({
  financialReports,
  period,
  periodStartedOn,
  revenueTitle,
  netIncomeTitle,
}: {
  financialReports: Update["financialReports"];
  period: Period;
  periodStartedOn: string;
  revenueTitle?: React.ReactNode;
  netIncomeTitle?: React.ReactNode;
}) {
  const months = period === "month" ? 1 : period === "quarter" ? 3 : 12;
  let netIncome: bigint | null = 0n;
  let revenue: bigint | null = 0n;
  let netIncomeLastYear: bigint | null = 0n;
  let revenueLastYear: bigint | null = 0n;

  for (let i = 0; i < months; ++i) {
    const date = addMonths(periodStartedOn, i);
    const report = financialReports.find(
      (report) => report.year === date.getFullYear() && report.month === date.getMonth() + 1,
    );
    const lastYearReport = financialReports.find(
      (report) => report.year === date.getFullYear() - 1 && report.month === date.getMonth() + 1,
    );

    netIncome = report?.netIncomeCents != null ? (netIncome ?? 0n) + report.netIncomeCents : null;
    revenue = report?.revenueCents != null ? (revenue ?? 0n) + report.revenueCents : null;

    netIncomeLastYear =
      lastYearReport?.netIncomeCents != null ? (netIncomeLastYear ?? 0n) + lastYearReport.netIncomeCents : null;
    revenueLastYear =
      lastYearReport?.revenueCents != null ? (revenueLastYear ?? 0n) + lastYearReport.revenueCents : null;
  }

  const netIncomeYoY =
    netIncome != null && netIncomeLastYear != null && netIncomeLastYear !== 0n
      ? Number(netIncome - netIncomeLastYear) / Math.abs(Number(netIncomeLastYear))
      : null;

  const revenueYoY =
    revenue != null && revenueLastYear != null && revenueLastYear !== 0n
      ? Number(revenue - revenueLastYear) / Math.abs(Number(revenueLastYear))
      : null;

  return netIncome != null || revenue != null ? (
    <>
      <h2 className="text-xl font-bold">Financial Overview</h2>
      <Card className="grid grid-cols-[1fr_auto_auto] gap-x-3">
        <CardRow className="col-span-full">
          <div className="text-gray-500">{formatPeriod(period, periodStartedOn)}</div>
        </CardRow>
        {revenue != null ? (
          <CardRow className="col-span-3 grid grid-cols-subgrid">
            <div>{revenueTitle ?? "Revenue"}</div>
            <div className="text-right tabular-nums">{revenue ? formatMoneyFromCents(revenue) : "-"}</div>
            {revenueYoY != null ? (
              <div>
                <Delta diff={revenueYoY} />
                <span className="text-gray-500"> Year over year</span>
              </div>
            ) : null}
          </CardRow>
        ) : null}
        {netIncome != null ? (
          <CardRow className="col-span-3 grid grid-cols-subgrid">
            <div>{netIncomeTitle ?? "Net income"}</div>
            <div className="text-right tabular-nums">{netIncome ? formatMoneyFromCents(netIncome) : "-"}</div>
            {netIncomeYoY != null ? (
              <div>
                <Delta diff={netIncomeYoY} />
                <span className="text-gray-500"> Year over year</span>
              </div>
            ) : null}
          </CardRow>
        ) : null}
      </Card>
    </>
  ) : null;
}

export const formatPeriod = (period: Period, periodStartedOn: string) => {
  switch (period) {
    case "year":
      return parseISO(periodStartedOn).getFullYear().toString();
    case "month":
      return formatMonth(periodStartedOn);
    case "quarter":
      return format(periodStartedOn, "QQQ");
  }
};
