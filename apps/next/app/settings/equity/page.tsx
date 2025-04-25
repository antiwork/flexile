"use client";

import { InformationCircleIcon } from "@heroicons/react/24/outline";
import React, { useState } from "react";
import SettingsLayout from "@/app/settings/Layout";
import { linkClasses } from "@/components/Link";
import MutationButton from "@/components/MutationButton";
import RangeInput from "@/components/RangeInput";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { MAX_EQUITY_PERCENTAGE } from "@/models";
import { trpc } from "@/trpc/client";
import { assert } from "@/utils/assert";
import { formatMoneyFromCents } from "@/utils/formatMoney";

function useEquitySplit(salary: number, equityPercentage: number) {
  const equityCents = Math.round(salary * equityPercentage);
  const cashCents = salary * 100 - equityCents;
  return { equityCents, cashCents };
}

export default function Equity() {
  const user = useCurrentUser();
  const worker = user.roles.worker;
  assert(worker != null);
  const company = useCurrentCompany();
  const [{ allocation }] = trpc.equitySettings.get.useSuspenseQuery({ companyId: company.id });

  const [equityPercent, setEquityPercent] = useState(allocation?.equityPercentage ?? 0);

  const { equityCents, cashCents } = useEquitySplit((worker.payRateInSubunits ?? 0) / 100, equityPercent);

  const submitMutation = trpc.equitySettings.update.useMutation();

  const getNoticeMessage = () => {
    if (worker.onTrial) {
      return "You'll be able to select an equity split after your trial period.";
    }
    if (allocation?.status === "pending_grant_creation" || allocation?.status === "pending_approval") {
      return "Your allocation is pending board approval. You can submit invoices for this year, but they're only going to be paid once the allocation is approved.";
    }
    if (allocation?.locked) {
      return `You'll be able to select a new allocation for ${new Date().getFullYear() + 1} later this year.`;
    }
    return null;
  };

  const noticeMessage = getNoticeMessage();

  return (
    <SettingsLayout>
      {noticeMessage ? (
        <Alert>
          <InformationCircleIcon />
          <AlertDescription>{noticeMessage}</AlertDescription>
        </Alert>
      ) : null}

      <div title="Equity split">
        <Card>
          <CardContent>
            <div className="grid gap-4">
              <RangeInput
                value={equityPercent}
                onChange={setEquityPercent}
                min={0}
                max={MAX_EQUITY_PERCENTAGE}
                aria-label="Cash vs equity split"
                unit="%"
                label={
                  <div className="flex justify-between gap-2">
                    How much of your rate would you like to swap for equity?
                    <a
                      className={linkClasses}
                      href="https://sahillavingia.com/dividends"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Learn more
                    </a>
                  </div>
                }
              />
            </div>
            <Separator />
            <div className="flex justify-between gap-2">
              <div>Cash amount</div>
              <div>
                {formatMoneyFromCents(cashCents)} <span className="text-gray-500">/ {worker.payRateType}</span>
              </div>
            </div>
            <Separator />
            <div className="flex justify-between gap-2">
              <div>Equity value</div>
              <div>
                {formatMoneyFromCents(equityCents)} <span className="text-gray-500">/ {worker.payRateType}</span>
              </div>
            </div>
            <Separator />
            <div className="flex justify-between gap-2">
              <div>Total amount</div>
              <div>
                {formatMoneyFromCents(equityCents + cashCents)}{" "}
                <span className="text-gray-500">/ {worker.payRateType}</span>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <MutationButton
              mutation={submitMutation}
              param={{ companyId: company.id, equityPercentage: equityPercent }}
              disabled={!!noticeMessage}
              loadingText="Saving..."
              successText="Equity split saved"
            >
              Save equity split
            </MutationButton>
          </CardFooter>
        </Card>
      </div>
    </SettingsLayout>
  );
}
