"use client";
import { useState } from "react";
import PersonalDetails from "@/app/onboarding/PersonalDetails";
import OnboardingLayout from "@/components/layouts/Onboarding";
import { useCurrentUser } from "@/global";
import { steps } from ".";
import WorkDetails from "./WorkDetails";

export default function Page() {
  const user = useCurrentUser();
  const [currentStep, setCurrentStep] = useState(() => {
    // Check if user needs work details (contractor invite user)
    const workerRole = user.roles.worker;
    const needsWorkDetails = workerRole?.payRateInSubunits === 1 && workerRole.role === "Contractor";
    return needsWorkDetails ? 1 : 2; // Step 1 = Work details, Step 2 = Personal details
  });

  const handleWorkDetailsComplete = () => {
    setCurrentStep(2); // Move to personal details step
  };

  const isWorkDetailsStep = currentStep === 1;
  const isPersonalDetailsStep = currentStep === 2;

  return (
    <OnboardingLayout
      steps={steps}
      stepIndex={currentStep}
      title={isWorkDetailsStep ? "Tell us about your work" : "Let's get to know you"}
      subtitle={
        isWorkDetailsStep
          ? "Help us understand your role, compensation, and work arrangement."
          : "We're eager to learn more about you, starting with your legal name and the place where you reside."
      }
    >
      {isWorkDetailsStep ? <WorkDetails onComplete={handleWorkDetailsComplete} /> : null}
      {isPersonalDetailsStep ? <PersonalDetails /> : null}
    </OnboardingLayout>
  );
}
