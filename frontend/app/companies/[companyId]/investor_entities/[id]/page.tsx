"use client";
import { CircleCheck } from "lucide-react";
import { useParams } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import MainLayout from "@/app/components/main-layout";
import Placeholder from "@/components/Placeholder";
import Tabs from "@/components/Tabs";
import { useCurrentCompany } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { formatMoney, formatMoneyFromCents } from "@/utils/formatMoney";
import { formatDate } from "@/utils/time";

type InvestorEntity = RouterOutput["investorEntities"]["get"];
type ShareHolding = InvestorEntity["shares"][number];
type EquityGrant = InvestorEntity["grants"][number];

export default function InvestorEntityPage() {
  const { id } = useParams<{ id: string }>();
  const company = useCurrentCompany();
  const tabs = [
    { label: "Options", tab: "options" },
    { label: "Shares", tab: "shares" },
  ] as const;
  const [selectedTab] = useQueryState("tab", parseAsString.withDefault(tabs[0].tab));
  const [data] = trpc.investorEntities.get.useSuspenseQuery({ companyId: company.id, id });

  return (
    <MainLayout title={data.name}>
      <Tabs links={tabs.map((tab) => ({ label: tab.label, route: `?tab=${tab.tab}` }))} />
      {selectedTab === "shares" ? <SharesTab shares={data.shares} /> : <OptionsTab grants={data.grants} />}
    </MainLayout>
  );
}

const sharesColumnHelper = createColumnHelper<ShareHolding>();
const sharesColumns = [
  sharesColumnHelper.simple("issuedAt", "Issue date", formatDate),
  sharesColumnHelper.simple("shareType", "Type"),
  sharesColumnHelper.simple("numberOfShares", "Number of shares", (v) => v.toLocaleString(), "numeric"),
  sharesColumnHelper.simple(
    "sharePriceUsd",
    "Share price",
    (v) => formatMoney(Number(v), { precise: true }),
    "numeric",
  ),
  sharesColumnHelper.simple("totalAmountInCents", "Cost", formatMoneyFromCents, "numeric"),
];

function SharesTab({ shares }: { shares: ShareHolding[] }) {
  const sharesTable = useTable({ data: shares, columns: sharesColumns });

  return shares.length > 0 ? (
    <DataTable table={sharesTable} />
  ) : (
    <Placeholder icon={CircleCheck}>This investor entity does not hold any shares.</Placeholder>
  );
}

const optionsColumnHelper = createColumnHelper<EquityGrant>();
const optionsColumns = [
  optionsColumnHelper.simple("issuedAt", "Issue date", formatDate),
  optionsColumnHelper.simple("numberOfShares", "Granted", (v) => v.toLocaleString(), "numeric"),
  optionsColumnHelper.simple("vestedShares", "Vested", (v) => v.toLocaleString(), "numeric"),
  optionsColumnHelper.simple("unvestedShares", "Unvested", (v) => v.toLocaleString(), "numeric"),
  optionsColumnHelper.simple("exercisedShares", "Exercised", (v) => v.toLocaleString(), "numeric"),
  optionsColumnHelper.simple(
    "exercisePriceUsd",
    "Exercise price",
    (v) => formatMoney(Number(v), { precise: true }),
    "numeric",
  ),
];

function OptionsTab({ grants }: { grants: EquityGrant[] }) {
  const optionsTable = useTable({ data: grants, columns: optionsColumns });

  return grants.length > 0 ? (
    <DataTable table={optionsTable} />
  ) : (
    <Placeholder icon={CircleCheck}>This investor entity does not have any option grants.</Placeholder>
  );
}
