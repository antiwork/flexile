import OnboardingLayout from "@/components/layouts/Onboarding";
import PersonalDetails from "./PersonalDetails";
import { steps } from ".";

export default function OnboardingPage() {
  return (
    <OnboardingLayout
      steps={steps}
      stepIndex={1}
      title="Let's get to know you"
      subtitle="We're eager to learn more about you, starting with your legal name and the place where you reside."
    >
      <PersonalDetails nextLinkTo="/dashboard" />
    </OnboardingLayout>
  );
}
