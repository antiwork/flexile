"use client";

import OnboardingLayout from "@/components/layouts/Onboarding";
import { steps } from "..";
import { CompanyDetails } from ".";

const Details = () => (
  <OnboardingLayout
    stepIndex={1}
    steps={steps}
    title="Set up your company"
    subtitle="We'll use this information to create contracts and bill you."
  >
    <CompanyDetails />
  </OnboardingLayout>
);

export default Details;
