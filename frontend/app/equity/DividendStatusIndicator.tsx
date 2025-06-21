import React from "react";
import Status from "@/components/Status";
import type { RouterOutput } from "@/trpc";

type Dividend = RouterOutput["dividends"]["list"][number];

const DividendStatusIndicator = ({ dividend }: { dividend: Dividend }) => {
  const getVariant = () => {
    switch (dividend.status) {
      case "Retained":
        return "critical";
      case "Paid":
        return "success";
      default:
        return undefined;
    }
  };

  return <Status variant={getVariant()}>{dividend.status}</Status>;
};

export default DividendStatusIndicator;
