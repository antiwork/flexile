import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDate, getLocalTimeZone, today } from "@internationalized/date";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import FormFields from "@/app/(dashboard)/people/FormFields";
import { MutationStatusButton } from "@/components/MutationButton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { useCurrentCompany } from "@/global";
import { PayRateType, trpc } from "@/trpc/client";

type OnboardingStepProps = {
  open: boolean;
  onNext: () => void;
  onBack: () => void;
};

const WorkerOnboardingModal = ({ open, onNext }: OnboardingStepProps) => {
  const company = useCurrentCompany();

  const form = useForm({
    resolver: zodResolver(
      z.object({
        startedAt: z.instanceof(CalendarDate),
        payRateInSubunits: z.number(),
        payRateType: z.nativeEnum(PayRateType),
        role: z.string(),
      }),
    ),
    defaultValues: {
      role: "",
      payRateType: PayRateType.Hourly,
      payRateInSubunits: 100,
      startedAt: today(getLocalTimeZone()),
    },
  });

  const trpcUtils = trpc.useUtils();
  const updateContractor = trpc.companyInviteLinks.completeOnboarding.useMutation({
    onSuccess: async () => {
      await trpcUtils.documents.list.invalidate();
      onNext();
    },
  });
  const submit = form.handleSubmit((values) => {
    updateContractor.mutate({ companyId: company.id, ...values, startedAt: values.startedAt.toString() });
  });

  return (
    <Dialog open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>What will you be doing at {company.name}?</DialogTitle>
          <DialogDescription>
            Set the type of work you'll be doing, your rate, and when you'd like to start.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={(e) => void submit(e)} className="space-y-4">
            <FormFields />
            <div className="flex flex-col items-end space-y-2">
              <MutationStatusButton mutation={updateContractor} type="submit">
                Continue
              </MutationStatusButton>
              {updateContractor.isError ? (
                <div className="text-red text-sm">{updateContractor.error.message}</div>
              ) : null}
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

const OnboardingCompleteModal = ({ open, onNext }: OnboardingStepProps) => {
  const company = useCurrentCompany();

  return (
    <Dialog open={open}>
      <DialogHeader className="sr-only">
        <DialogTitle>Onboarding Complete</DialogTitle>
      </DialogHeader>
      <DialogContent className="w-full max-w-md text-center">
        <div className="flex flex-col items-center justify-center">
          <div className="mb-2 w-full text-left text-base font-semibold">You're all set!</div>
          <div className="mb-4 w-full text-left text-base">
            Your details have been submitted. {company.name} will be in touch if anything else is needed.
          </div>
          <div className="flex w-full flex-col items-end space-y-2">
            <Button
              size="small"
              onClick={() => {
                onNext();
              }}
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const onboardingSteps: React.ComponentType<OnboardingStepProps>[] = [WorkerOnboardingModal, OnboardingCompleteModal];

type FinishOnboardingProps = {
  handleComplete: () => void;
};

export const FinishOnboarding = ({ handleComplete }: FinishOnboardingProps) => {
  const [currentStep, setCurrentStep] = useState(0);

  const goToNextStep = () => {
    if (currentStep < onboardingSteps.length - 1) {
      setCurrentStep((step) => step + 1);
    } else {
      handleComplete();
    }
  };

  const goToPreviousStep = () => {
    setCurrentStep((step) => Math.max(step - 1, 0));
  };

  return (
    <>
      {onboardingSteps.map((Step, idx) => (
        <Step key={idx} open={idx === currentStep} onNext={goToNextStep} onBack={goToPreviousStep} />
      ))}
    </>
  );
};
