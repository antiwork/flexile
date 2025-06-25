import React from "react";
import Status from "@/components/Status";
import type { RouterOutput } from "@/trpc";
import { Signature } from "lucide-react";
import { ExclamationTriangleIcon } from "@heroicons/react/20/solid";

type Dividend = RouterOutput["dividends"]["list"][number];

const DividendStatusIndicator = ({ dividend }: { dividend: Dividend }) => {
  if (dividend.status === "Issued" && !dividend.signedReleaseAt && dividend.dividendRound.releaseDocument)
    return (
      <Status variant="primary" icon={<Signature className="size-4" />}>
        Signature required
      </Status>
    );
  if (dividend.status === "Retained") {
    if (dividend.retainedReason === "below_minimum_payment_threshold")
      return (
        <Status icon={<ExclamationTriangleIcon className="text-yellow size-4" />}>Retained — Threshold not met</Status>
      );
    return (
      <Status variant="critical">
        Retained{dividend.retainedReason === "ofac_sanctioned_country" && " — Country restrictions"}
      </Status>
    );
  }

  return <Status variant={dividend.status === "Paid" ? "success" : undefined}>{dividend.status}</Status>;
};

export default DividendStatusIndicator;
