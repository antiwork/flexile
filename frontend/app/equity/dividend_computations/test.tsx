"use client";

import { Suspense } from "react";
import { useCurrentCompany } from "@/global";
import { trpc } from "@/trpc/client";
import EquityLayout from "@/app/equity/Layout";

function TestContent() {
  const company = useCurrentCompany();
  const [computations] = trpc.dividendComputations.list.useSuspenseQuery(
    { companyId: company.id }
  );

  return (
    <div>
      <h1>Test Dividend Computations</h1>
      <p>Found {computations.length} computations</p>
      <ul>
        {computations.map((comp: any) => (
          <li key={comp.id}>
            {comp.id}: ${comp.total_amount_in_usd} ({comp.confirmed_at ? 'Confirmed' : 'Draft'})
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function TestPage() {
  return (
    <EquityLayout>
      <Suspense fallback={<div>Loading...</div>}>
        <TestContent />
      </Suspense>
    </EquityLayout>
  );
}