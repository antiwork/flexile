"use client";
import React, { Suspense } from "react";
import { steps as adminSteps } from "@/app/companies/[companyId]/administrator/onboarding";
import { CompanyDetails } from "@/app/companies/[companyId]/administrator/onboarding/details";
import OnboardingLayout from "@/components/layouts/Onboarding";

export default function SignUp() {
  return (
    <OnboardingLayout
      stepIndex={1}
      steps={adminSteps}
      title="Let's get to know you"
      subtitle="We'll use this information for contracts and payments."
    >
      <Suspense>
        <CompanyDetails />
      </Suspense>
    </OnboardingLayout>
  );
}
