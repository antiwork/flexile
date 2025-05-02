import PersonalDetails from "@/app/onboarding/PersonalDetails";
import OnboardingLayout from "@/components/layouts/Onboarding";
import { steps } from ".";

export default async function Page({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  return (
    <OnboardingLayout
      steps={steps}
      stepIndex={1}
      title="Let's get to know you"
      subtitle="We're eager to learn more about you, starting with your legal name and the place where you reside."
    >
      <PersonalDetails nextLinkTo={`/companies/${companyId}/investor/onboarding/bank_account`} />
    </OnboardingLayout>
  );
}
