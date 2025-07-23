import { capitalize } from "lodash-es";
import React from "react";
import Status from "@/components/Status";
import type { RouterOutput } from "@/trpc";

type EquityGrantExercise = RouterOutput["equityGrantExercises"]["list"][number];

const EquityGrantExerciseStatusIndicator = ({ status }: { status: EquityGrantExercise["status"] }) => {
  const getVariant = () => {
    switch (status) {
      case "completed":
        return "success";
      case "cancelled":
        return "critical";
      case "signed":
        return "primary";
      default:
        return undefined;
    }
  };

  return <Status variant={getVariant()}>{capitalize(status)}</Status>;
};

export default EquityGrantExerciseStatusIndicator;
