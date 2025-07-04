import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { getLocalTimeZone, today, CalendarDate } from "@internationalized/date";

import { PayRateType, trpc } from "@/trpc/client";
import { useCurrentCompany } from "@/global";
import { DEFAULT_WORKING_HOURS_PER_WEEK } from "@/models";

import DatePicker from "@/components/DatePicker";
import NumberInput from "@/components/NumberInput";
import RadioButtons from "@/components/RadioButtons";
import { MutationStatusButton } from "@/components/MutationButton";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { PopoverTrigger } from "@radix-ui/react-popover";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { z } from "zod";
import { Button } from "@/components/ui/button";

type OnboardingStepProps = {
  open: boolean;
  onNext: () => void;
  onBack: () => void;
};

const WorkerOnboardingModal = ({ open, onNext }: OnboardingStepProps) => {
  const company = useCurrentCompany();
  const defaultRoles = ["Software Engineer", "Designer", "Product Manager", "Data Analyst"];
  const [rolePopoverOpen, setRolePopoverOpen] = useState(false);

  const form = useForm({
    resolver: zodResolver(
      z.object({
        startedAt: z.instanceof(CalendarDate),
        payRateInSubunits: z.number(),
        payRateType: z.nativeEnum(PayRateType),
        hoursPerWeek: z.number().nullable(),
        role: z.string(),
      }),
    ),
    defaultValues: {
      role: "",
      payRateType: PayRateType.Hourly,
      hoursPerWeek: DEFAULT_WORKING_HOURS_PER_WEEK,
      payRateInSubunits: 100,
      startedAt: today(getLocalTimeZone()),
    },
  });
  const payRateType: unknown = form.watch("payRateType");
  const roleRegex = new RegExp(form.watch("role"), "iu");

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
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>What will you be doing at {company.name}?</DialogTitle>
          <DialogDescription>
            Set the type of work you'll be doing, your rate, and when you'd like to start.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={(e) => void submit(e)} className="space-y-4">
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Command shouldFilter={false} value={defaultRoles.find((role) => roleRegex.test(role)) ?? ""}>
                    <Popover open={rolePopoverOpen} onOpenChange={setRolePopoverOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Input {...field} type="text" />
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent
                        onOpenAutoFocus={(e) => e.preventDefault()}
                        className="p-0"
                        style={{ width: "var(--radix-popover-trigger-width)" }}
                      >
                        <CommandList>
                          <CommandGroup>
                            {defaultRoles.map((option) => (
                              <CommandItem
                                key={option}
                                value={option}
                                onSelect={(e) => {
                                  field.onChange(e);
                                  setRolePopoverOpen(false);
                                }}
                              >
                                {option}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </PopoverContent>
                    </Popover>
                  </Command>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="startedAt"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <DatePicker {...field} label="Start date" granularity="day" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="payRateType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <FormControl>
                    <RadioButtons
                      {...field}
                      options={[
                        { label: "Hourly", value: PayRateType.Hourly } as const,
                        { label: "Project-based", value: PayRateType.ProjectBased } as const,
                      ]}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div
              className={`grid items-start gap-3 ${payRateType === PayRateType.ProjectBased ? "md:grid-cols-1" : "md:grid-cols-2"}`}
            >
              <FormField
                control={form.control}
                name="payRateInSubunits"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rate</FormLabel>
                    <FormControl>
                      <NumberInput
                        value={field.value == null ? null : field.value / 100}
                        onChange={(value) => field.onChange(value == null ? null : value * 100)}
                        placeholder="0"
                        prefix="$"
                        suffix={payRateType === PayRateType.ProjectBased ? "/ project" : "/ hour"}
                        decimal
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {payRateType !== PayRateType.ProjectBased && (
                <FormField
                  control={form.control}
                  name="hoursPerWeek"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Average hours</FormLabel>
                      <FormControl>
                        <NumberInput {...field} suffix="/ week" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

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
    <Dialog open={open} onOpenChange={() => {}}>
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
