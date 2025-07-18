import React from "react";

const Delta = ({ diff }: { diff: number | bigint }) => (
  <span className={diff > 0 ? "text-green" : diff < 0 ? "text-red" : "text-gray-500"}>
    {diff.toLocaleString(undefined, { style: "percent", maximumFractionDigits: 2 })}
  </span>
);

export default Delta;
