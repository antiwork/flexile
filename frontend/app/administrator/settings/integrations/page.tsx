"use client";

import { useCurrentCompany } from "@/global";
import QuickbooksIntegration from "../QuickbooksIntegration";
import StripeMicrodepositVerification from "../StripeMicrodepositVerification";

export default function IntegrationsPage() {
  const company = useCurrentCompany();

  return (
    <>
      <hgroup className="mb-8">
        <h2 className="mb-1 text-xl font-bold">Integrations</h2>
        <p className="text-base text-gray-600">Connect Flexile to your company's favorite tools.</p>
      </hgroup>

      <div className="grid gap-8">
        <StripeMicrodepositVerification />
        {company.flags.includes("quickbooks") && <QuickbooksIntegration />}
      </div>
    </>
  );
}
