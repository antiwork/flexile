"use client";

import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { z } from "zod";
import OnboardingLayout from "@/components/layouts/Onboarding";
import MutationButton from "@/components/MutationButton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import env from "@/env/client";
import { useCurrentCompany } from "@/global";
import { request } from "@/utils/request";
import {
  added_bank_account_company_administrator_onboarding_path,
  bank_account_company_administrator_onboarding_path,
} from "@/utils/routes";
import { steps } from "..";

const useData = () => {
  const company = useCurrentCompany();
  return useSuspenseQuery({
    queryKey: ["administratorOnboardingBankAccount", company.id],
    queryFn: async () => {
      const response = await request({
        method: "GET",
        url: bank_account_company_administrator_onboarding_path(company.id),
        accept: "json",
        assertOk: true,
      });
      return z
        .object({
          client_secret: z.string(),
          setup_intent_status: z.string(),
          stripe_public_key: z.string(),
          name: z.string(),
          email: z.string(),
          unsigned_document_id: z.number().nullable(),
        })
        .parse(await response.json());
    },
  });
};

const appearance = {
  variables: {
    colorPrimary: "rgba(83, 87, 83, 0.9)",
    colorBackground: "#ffffff",
    colorText: "rgba(4, 5, 0, 0.9)",
    colorDanger: "rgba(219, 53, 0, 1)",
    fontFamily: "ABC Whyte, sans-serif",
    spacingUnit: "4px",
    borderRadius: "4px",
    fontWeightMedium: "500",
    fontSizeBase: "0.875rem",
    colorIcon: "rgba(83, 87, 83, 0.9)",
  },
  rules: {
    ".Link:hover": { textDecoration: "underline" },
    ".Label": { color: "rgba(83, 87, 83, 0.9)" },
    ".Input": { border: "1px solid rgba(83, 87, 83, 0.9)" },
    ".Input:hover": { borderColor: "rgba(4, 5, 0, 0.9)" },
    ".Input:focus": { borderColor: "rgba(4, 5, 0, 0.9)", outline: "2px rgba(214, 233, 255, 1)" },
    ".Input--invalid": { borderColor: "var(--colorDanger)" },
    ".PickerItem": { border: "1px solid rgba(83, 87, 83, 0.9)", padding: "var(--fontSize2Xl)" },
    ".MenuIcon:hover": { backgroundColor: "rgba(240, 247, 255, 1)" },
    ".MenuAction": { backgroundColor: "#f7f9fa" },
    ".MenuAction:hover": { backgroundColor: "rgba(240, 247, 255, 1)" },
    ".Dropdown": { border: "1px solid rgba(83, 87, 83, 0.9)" },
    ".DropdownItem": { padding: "var(--fontSizeLg)" },
    ".DropdownItem--highlight": { backgroundColor: "rgba(240, 247, 255, 1)" },
    ".TermsText": { fontSize: "var(--fontSizeBase)" },
  },
};

const paymentElementOptions = {
  fields: { billingDetails: { name: "never", email: "never" } },
} as const;

const stripePromise = loadStripe(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
const BankAccountPage = () => {
  const { data } = useData();

  return (
    <OnboardingLayout
      stepIndex={2}
      steps={steps}
      title="Link your bank account"
      subtitle="We'll use this account to debit contractor payments and our monthly fee. You won't be charged until the first payment."
    >
      <Elements stripe={stripePromise} options={{ appearance, clientSecret: data.client_secret }}>
        <Form />
      </Elements>
    </OnboardingLayout>
  );
};

const Form = () => {
  const company = useCurrentCompany();
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const { data } = useData();

  const saveMutation = useMutation({
    mutationFn: async () => {
      await request({
        method: "PATCH",
        url: added_bank_account_company_administrator_onboarding_path(company.id),
        accept: "json",
        assertOk: true,
      });
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!stripe || !elements) return;

      const { error } = await stripe.confirmSetup({
        elements,
        redirect: "if_required",
        confirmParams: {
          payment_method_data: {
            billing_details: { name: data.name, email: data.email },
          },
        },
      });

      if (error) throw error;

      router.push(data.unsigned_document_id ? `/documents?sign=${data.unsigned_document_id}` : "/people");
    },
  });
  return (
    <form className="grid gap-4">
      <PaymentElement
        options={paymentElementOptions}
        onChange={(e) => {
          if (e.complete) saveMutation.mutate();
        }}
      />
      <Alert>
        <InformationCircleIcon />
        <AlertTitle>Payments to contractors may take up to 10 business days to process.</AlertTitle>
        <AlertDescription>
          Want faster payments? Email us at <a href="mailto:support@flexile.com">support@flexile.com</a> to complete
          additional verification steps.
        </AlertDescription>
      </Alert>
      <MutationButton
        mutation={submit}
        idleVariant="primary"
        disabled={!saveMutation.isSuccess}
        loadingText="Starting..."
      >
        Start using Flexile
      </MutationButton>
      {submit.error ? <div>{submit.error.message}</div> : null}
    </form>
  );
};

export default BankAccountPage;
