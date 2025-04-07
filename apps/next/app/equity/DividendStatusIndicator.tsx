import Status from "@/components/Status";
import type { RouterOutput } from "@/trpc";
import React from "react";

type Dividend = RouterOutput["dividends"]["list"]["dividends"][number];

const DividendStatusIndicator = ({ status }: { status: Dividend["status"] }) => {
  const getVariant = () => {
    switch (status) {
      case "Retained":
        return "critical";
      case "Paid":
        return "success";
      default:
        return undefined;
    }
  };

  return <Status variant={getVariant()}>{status}</Status>;
};

export default DividendStatusIndicator;
