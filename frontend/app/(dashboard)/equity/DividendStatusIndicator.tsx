import React from "react";
import Status from "@/components/Status";
import type { RouterOutput } from "@/trpc";

type Dividend = RouterOutput["dividends"]["list"][number];

const DividendStatusIndicator = ({ dividend }: { dividend: Dividend }) => {
  if (dividend.status === "Issued" && !dividend.signedReleaseAt && dividend.dividendRound.releaseDocument)
    return <Status variant="primary">Signature required</Status>;
  if (dividend.status === "Retained") {
    if (dividend.retainedReason === "below_minimum_payment_threshold")
      return <Status>Retained — Threshold not met</Status>;
    return (
      <Status variant="critical">
        Retained{dividend.retainedReason === "ofac_sanctioned_country" && " — Country restrictions"}
      </Status>
    );
  }

  return <Status variant={dividend.status === "Paid" ? "success" : undefined}>{dividend.status}</Status>;
};

export default DividendStatusIndicator;
