"use client";
import { BanknotesIcon, CheckCircleIcon } from "@heroicons/react/24/solid";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { Route } from "next";
import { useState } from "react";
import { z } from "zod";
import BankAccountModal from "@/app/settings/payouts/BankAccountModal";
import type { BankAccount } from "@/app/settings/payouts/BankAccountModal";
import { Card, CardRow } from "@/components/Card";
import OnboardingLayout from "@/components/layouts/Onboarding";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/Tooltip";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/global";
import { CURRENCIES, supportedCountries } from "@/models/constants";
import { request } from "@/utils/request";
import { bank_account_onboarding_path } from "@/utils/routes";

const BankAccountPage = <T extends string>({
  header,
  subheading,
  nextLinkTo,
  steps,
}: {
  header: string;
  subheading: string;
  nextLinkTo?: Route<T>;
  steps: string[];
}) => {
  useCurrentUser(); // to clear the onboarding path
  const { data } = useSuspenseQuery({
    queryKey: ["onboardingBankAccount"],
    queryFn: async () => {
      const response = await request({
        method: "GET",
        url: bank_account_onboarding_path(),
        accept: "json",
        assertOk: true,
      });
      return z
        .object({
          country: z.string(),
          country_code: z.string(),
          state: z.string().nullable(),
          city: z.string(),
          zip_code: z.string(),
          street_address: z.string(),
          email: z.string(),
          billing_entity_name: z.string(),
          legal_type: z.enum(["BUSINESS", "PRIVATE"]),
          unsigned_document_id: z.number().nullable(),
        })
        .parse(await response.json());
    },
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [completed, setCompleted] = useState<BankAccount | null>(null);

  return (
    <OnboardingLayout stepIndex={steps.indexOf("Bank account")} steps={steps} title={header} subtitle={subheading}>
      <Card>
        <CardRow className="flex justify-between gap-2">
          <div className="flex items-center gap-3">
            {completed ? (
              <CheckCircleIcon className="size-8 text-green-500" />
            ) : (
              <BanknotesIcon className="size-8 text-gray-500" />
            )}
            <div>
              <h3 className="text-lg">
                <strong>{completed ? `Account ending in ${completed.last_four_digits}` : "Bank transfer"}</strong>
              </h3>
              {completed?.currency ??
                (!supportedCountries.has(data.country_code)
                  ? `Your account must be outside ${data.country}`
                  : `${CURRENCIES.length} currencies available`)}
            </div>
          </div>
          <Button variant="outline" disabled={!!completed} onClick={() => setModalOpen(true)}>
            {completed ? "Done" : "Set up"}
          </Button>
        </CardRow>
      </Card>
      <footer>
        <Tooltip>
          <TooltipTrigger asChild={!!completed}>
            <Button className="w-full" asChild>
              {/* not using Link here because it causes an error on CI; let's reevaluate later */}
              <a
                href={data.unsigned_document_id ? `/documents?sign=${data.unsigned_document_id}` : nextLinkTo}
                inert={!completed}
              >
                Continue
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{!completed ? "Set up a bank account to continue." : undefined}</TooltipContent>
        </Tooltip>
      </footer>
      {modalOpen ? (
        <BankAccountModal
          billingDetails={data}
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onComplete={(bankAccount) => {
            setCompleted(bankAccount);
            setModalOpen(false);
          }}
        />
      ) : null}
    </OnboardingLayout>
  );
};

export default BankAccountPage;
