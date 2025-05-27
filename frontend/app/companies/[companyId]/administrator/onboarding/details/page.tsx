"use client";

import OnboardingLayout from "@/app/onboarding/layout";
import { OnboardingProvider } from "@/app/onboarding/context";
import { CompanyDetails } from ".";
import { steps } from "..";

const Details = () => (
  <OnboardingProvider
    stepIndex={1}
    steps={steps}
    title="Set up your company"
    subtitle="We'll use this information to create contracts and bill you."
  >
    <OnboardingLayout>
      <CompanyDetails />
    </OnboardingLayout>
  </OnboardingProvider>
);

export default Details;
