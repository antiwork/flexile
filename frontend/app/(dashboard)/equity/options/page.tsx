"use client";

import { useMutation } from "@tanstack/react-query";
import { isFuture } from "date-fns";
import { CircleCheck, Info } from "lucide-react";
import { forbidden } from "next/navigation";
import { useState } from "react";
import DetailsModal from "@/app/(dashboard)/equity/grants/DetailsModal";
import ExerciseModal from "@/app/(dashboard)/equity/grants/ExerciseModal";
import { DashboardHeader } from "@/components/DashboardHeader";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import MutationButton from "@/components/MutationButton";
import Placeholder from "@/components/Placeholder";
import TableSkeleton from "@/components/TableSkeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { useCurrentCompany, useCurrentUser } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { formatMoney, formatMoneyFromCents } from "@/utils/formatMoney";
import { request } from "@/utils/request";
import { resend_company_equity_grant_exercise_path } from "@/utils/routes";

type EquityGrant = RouterOutput["equityGrants"]["list"][number];
const investorGrantColumnHelper = createColumnHelper<EquityGrant>();
const investorGrantColumns = [
  investorGrantColumnHelper.simple("periodStartedAt", "Period", (v) => new Date(v).getFullYear(), "numeric"),
  investorGrantColumnHelper.simple("numberOfShares", "Granted", (v) => v.toLocaleString(), "numeric"),
  investorGrantColumnHelper.simple("vestedShares", "Vested", (v) => v.toLocaleString(), "numeric"),
  investorGrantColumnHelper.simple("unvestedShares", "Unvested", (v) => v.toLocaleString(), "numeric"),
  investorGrantColumnHelper.simple(
    "exercisePriceUsd",
    "Exercise price",
    (v) => formatMoney(v, { precise: true }),
    "numeric",
  ),
];

export default function OptionsPage() {
  const company = useCurrentCompany();
  const user = useCurrentUser();
  if (!user.roles.investor) forbidden();
  const { data = [], isLoading } = trpc.equityGrants.list.useQuery({
    companyId: company.id,
    investorId: user.roles.investor.id,
    orderBy: "periodEndedAt" as const,
    eventuallyExercisable: true,
    accepted: true,
  });
  const [selectedEquityGrant, setSelectedEquityGrant] = useState<EquityGrant | null>(null);
  const [exercisableGrants, setExercisableGrants] = useState<EquityGrant[]>([]);
  const [showExerciseModal, setShowExerciseModal] = useState(false);

  const table = useTable({ columns: investorGrantColumns, data });

  const totalUnexercisedVestedShares = data.reduce((acc, grant) => {
    if (!grant.activeExercise && isFuture(new Date(grant.expiresAt))) {
      return acc + grant.vestedShares;
    }
    return acc;
  }, 0);
  const exerciseInProgress = data.find((grant) => grant.activeExercise)?.activeExercise;

  const openExerciseModal = () => {
    const grants = data.filter(
      (grant) => !grant.activeExercise && grant.vestedShares > 0 && isFuture(new Date(grant.expiresAt)),
    );

    if (grants.length > 0) {
      setExercisableGrants(grants);
      setShowExerciseModal(true);
    }
  };

  const exerciseGrant = () => {
    if (selectedEquityGrant) {
      setExercisableGrants([selectedEquityGrant]);
      setSelectedEquityGrant(null);
      setShowExerciseModal(true);
    }
  };

  const resendPaymentInstructions = useMutation({
    mutationFn: async (exerciseId: bigint) => {
      await request({
        method: "POST",
        url: resend_company_equity_grant_exercise_path(company.id, exerciseId),
        assertOk: true,
        accept: "json",
      });
    },
    onSuccess: () => setTimeout(() => resendPaymentInstructions.reset(), 5000),
  });

  return (
    <>
      <DashboardHeader
        title={
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>Equity</BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Options</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        }
      />
      {isLoading ? (
        <TableSkeleton columns={5} />
      ) : data.length === 0 ? (
        <Placeholder icon={CircleCheck}>You don't have any option grants right now.</Placeholder>
      ) : (
        <>
          {company.flags.includes("option_exercising") && (
            <>
              {totalUnexercisedVestedShares > 0 && !exerciseInProgress && (
                <Alert className="mb-4 w-full">
                  <Info />
                  <AlertDescription>
                    <div className="flex items-center justify-between">
                      <span className="font-bold">
                        You have {totalUnexercisedVestedShares.toLocaleString()} vested options available for exercise.
                      </span>
                      <Button size="small" onClick={openExerciseModal}>
                        Exercise Options
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {exerciseInProgress ? (
                <Alert className="mb-4 w-full">
                  <Info />
                  <AlertDescription>
                    <div className="flex items-center justify-between">
                      <span className="font-bold">
                        We're awaiting a payment of {formatMoneyFromCents(exerciseInProgress.totalCostCents)} to
                        exercise {exerciseInProgress.numberOfOptions.toLocaleString()} options.
                      </span>
                      <MutationButton
                        size="small"
                        mutation={resendPaymentInstructions}
                        param={exerciseInProgress.id}
                        successText="Payment instructions sent!"
                      >
                        Resend payment instructions
                      </MutationButton>
                    </div>
                  </AlertDescription>
                </Alert>
              ) : null}
            </>
          )}

          <DataTable table={table} onRowClicked={setSelectedEquityGrant} />

          {selectedEquityGrant ? (
            <DetailsModal
              equityGrant={selectedEquityGrant}
              userId={selectedEquityGrant.user.id}
              canExercise={!exerciseInProgress}
              onClose={() => setSelectedEquityGrant(null)}
              onUpdateExercise={exerciseGrant}
            />
          ) : null}

          {showExerciseModal ? (
            <ExerciseModal
              equityGrants={exercisableGrants}
              companySharePrice={company.sharePriceInUsd ?? "0"}
              companyValuation={company.valuationInDollars || 0}
              onClose={() => setShowExerciseModal(false)}
            />
          ) : null}
        </>
      )}
    </>
  );
}
