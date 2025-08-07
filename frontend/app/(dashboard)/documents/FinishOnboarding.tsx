import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDate, getLocalTimeZone, today } from "@internationalized/date";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import FormFields from "@/app/(dashboard)/people/FormFields";
import ContractField, { schema as contractSchema } from "@/components/ContractField";
import { MutationStatusButton } from "@/components/MutationButton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { useCurrentCompany, useUserStore } from "@/global";
import { PayRateType } from "@/trpc/client";
import { request } from "@/utils/request";
import { company_worker_path } from "@/utils/routes";

type OnboardingStepProps = {
  open: boolean;
  onNext: () => void;
  onBack: () => void;
};

const schema = contractSchema.extend({
  startedAt: z.instanceof(CalendarDate),
  payRateInSubunits: z.number(),
  payRateType: z.nativeEnum(PayRateType),
  skipContract: z.boolean().optional(),
  role: z.string(),
});

const WorkerOnboardingModal = ({ open, onNext }: OnboardingStepProps) => {
  const company = useCurrentCompany();
  const user = useUserStore((state) => state.user);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      role: "",
      skipContract: false,
      payRateType: PayRateType.Hourly,
      payRateInSubunits: 100,
      startedAt: today(getLocalTimeZone()),
    },
  });

  const queryClient = useQueryClient();

  const updateContractor = useMutation({
    mutationFn: async (data: z.infer<typeof schema>) => {
      if (!user?.roles.worker) {
        throw new Error("Worker role not found");
      }
      let response;
      if (data.attachment) {
        const formData = new FormData();
        formData.append("contractor[role]", data.role);
        formData.append("contractor[pay_rate_type]", data.payRateType.toString());
        formData.append("contractor[pay_rate_in_subunits]", data.payRateInSubunits.toString());
        formData.append("contractor[started_at]", data.startedAt.toString());
        formData.append("contractor[contract_signed_elsewhere]", (data.skipContract ?? false).toString());

        formData.append("document[attachment]", data.attachment);
        formData.append("document[name]", data.attachment.name);
        formData.append("document[signed]", data.signed.toString());
        response = await request({
          url: company_worker_path(company.id, user.roles.worker.id),
          method: "PATCH",
          accept: "json",
          formData,
          assertOk: true,
        });
      } else {
        const payload = {
          contractor: {
            contract_signed_elsewhere: data.skipContract ?? false,
            started_at: data.startedAt.toString(),
            pay_rate_in_subunits: data.payRateInSubunits,
            pay_rate_type: data.payRateType,
            role: data.role,
          },
          document: {
            text_content: data.content,
            attachment: data.attachment,
            signed: false,
          },
        };
        response = request({
          url: company_worker_path(company.id, user.roles.worker.id),
          method: "PATCH",
          accept: "json",
          jsonData: payload,
          assertOk: true,
        });
      }
      return response;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
      onNext();
    },
  });
  const submit = form.handleSubmit((values) => {
    updateContractor.mutate(values);
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

            <FormField
              control={form.control}
              name="skipContract"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Switch checked={!!field.value} onCheckedChange={field.onChange} label="Skip contract for now." />
                  </FormControl>
                </FormItem>
              )}
            />
            {form.watch("skipContract") ? null : <ContractField />}
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
