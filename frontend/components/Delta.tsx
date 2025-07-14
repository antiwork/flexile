import React from "react";

const Delta = ({ percentDiff }: { percentDiff: number | bigint }) => (
  <span className={percentDiff > 0 ? "text-green" : percentDiff < 0 ? "text-red" : "text-gray-500"}>
    {percentDiff.toLocaleString(undefined, { style: "percent", maximumFractionDigits: 2 })}
  </span>
);

export default Delta;
