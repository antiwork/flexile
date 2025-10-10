"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import ComboBox from "@/components/ComboBox";
import { MutationStatusButton } from "@/components/MutationButton";
import NumberInput from "@/components/NumberInput";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useCurrentCompany } from "@/global";
import { trpc } from "@/trpc/client";
import { request } from "@/utils/request";
import { company_administrator_option_pools_path } from "@/utils/routes";

const schema = z.object({
  name: z.string().min(1, "Must be present."),
  shareClassId: z.string().min(1, "Must be present."),
  authorizedShares: z.number().gt(0),
  defaultOptionExpiryMonths: z.number().min(0).default(120),
  voluntaryTerminationExerciseMonths: z.number().min(0).default(120),
  involuntaryTerminationExerciseMonths: z.number().min(0).default(120),
  terminationWithCauseExerciseMonths: z.number().min(0).default(0),
  deathExerciseMonths: z.number().min(0).default(120),
  disabilityExerciseMonths: z.number().min(0).default(120),
  retirementExerciseMonths: z.number().min(0).default(120),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function NewOptionPoolModal({ open, onOpenChange }: Props) {
  const company = useCurrentCompany();
  const trpcUtils = trpc.useUtils();
  const [showExercise, setShowExercise] = useState(false);

  const { data: shareClasses } = trpc.shareClasses.list.useQuery({ companyId: company.id });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      shareClassId: "",
      authorizedShares: 0,
      defaultOptionExpiryMonths: 120,
      voluntaryTerminationExerciseMonths: 120,
      involuntaryTerminationExerciseMonths: 120,
      terminationWithCauseExerciseMonths: 0,
      deathExerciseMonths: 120,
      disabilityExerciseMonths: 120,
      retirementExerciseMonths: 120,
    },
  });

  const createPool = useMutation({
    mutationFn: async (values: FormValues) => {
      const formData = new FormData();
      formData.append("option_pool[name]", values.name);
      formData.append("option_pool[authorized_shares]", values.authorizedShares.toString());
      formData.append("option_pool[share_class_id]", values.shareClassId);
      formData.append("option_pool[default_option_expiry_months]", values.defaultOptionExpiryMonths.toString());
      formData.append(
        "option_pool[voluntary_termination_exercise_months]",
        values.voluntaryTerminationExerciseMonths.toString(),
      );
      formData.append(
        "option_pool[involuntary_termination_exercise_months]",
        values.involuntaryTerminationExerciseMonths.toString(),
      );
      formData.append(
        "option_pool[termination_with_cause_exercise_months]",
        values.terminationWithCauseExerciseMonths.toString(),
      );
      formData.append("option_pool[death_exercise_months]", values.deathExerciseMonths.toString());
      formData.append("option_pool[disability_exercise_months]", values.disabilityExerciseMonths.toString());
      formData.append("option_pool[retirement_exercise_months]", values.retirementExerciseMonths.toString());

      const response = await request({
        url: company_administrator_option_pools_path(company.id),
        method: "POST",
        formData,
        accept: "json",
      });

      if (!response.ok) {
        const error =
          z.object({ error: z.string() }).safeParse(await response.json()).data?.error ||
          "Failed to create a new option pool";
        form.setError("root", { message: error });
        throw new Error(error);
      }

      await trpcUtils.optionPools.list.invalidate();
      handleClose();
    },
  });

  const submit = form.handleSubmit((values) => createPool.mutate(values));

  const handleClose = () => {
    setShowExercise(false);
    form.reset();
    onOpenChange(false);
  };

  const shareClassOptions = (shareClasses ?? []).map((c: { id: unknown; name: string }) => ({
    label: c.name,
    value: String(c.id),
  }));

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl overflow-y-auto" onPrimaryAction={() => submit()}>
        <DialogHeader>
          <DialogTitle className="text-xl font-medium">New option pool</DialogTitle>
          <DialogDescription>Fill in the details below to create an option pool.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={(e) => void submit(e)} className="grid gap-4">
            <div className="grid gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pool name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Equity plan name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="shareClassId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Share class</FormLabel>
                    <FormControl>
                      <ComboBox {...field} options={shareClassOptions} placeholder="Select share class" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="authorizedShares"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Authorized shares</FormLabel>
                    <FormControl>
                      <NumberInput {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4">
              <Button
                type="button"
                variant="ghost"
                className="flex h-auto w-full items-start justify-between p-0 text-left whitespace-break-spaces hover:bg-transparent"
                onClick={() => setShowExercise(!showExercise)}
              >
                <h2 className="text-base font-medium">Customize post-termination exercise periods</h2>
                {showExercise ? (
                  <ChevronDown className="mt-[3px] size-5" />
                ) : (
                  <ChevronRight className="mt-[3px] size-5" />
                )}
              </Button>

              {showExercise ? (
                <div className="grid gap-4">
                  <FormField
                    control={form.control}
                    name="defaultOptionExpiryMonths"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expiration period</FormLabel>
                        <FormControl>
                          <NumberInput {...field} suffix="months" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="voluntaryTerminationExerciseMonths"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Voluntary termination</FormLabel>
                          <FormControl>
                            <NumberInput {...field} suffix="months" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="involuntaryTerminationExerciseMonths"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Involuntary termination</FormLabel>
                          <FormControl>
                            <NumberInput {...field} suffix="months" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="terminationWithCauseExerciseMonths"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Termination with cause</FormLabel>
                          <FormControl>
                            <NumberInput {...field} suffix="months" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="deathExerciseMonths"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Death</FormLabel>
                          <FormControl>
                            <NumberInput {...field} suffix="months" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="disabilityExerciseMonths"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Disability</FormLabel>
                          <FormControl>
                            <NumberInput {...field} suffix="months" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="retirementExerciseMonths"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Retirement</FormLabel>
                          <FormControl>
                            <NumberInput {...field} suffix="months" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              ) : null}
            </div>

            {form.formState.errors.root ? (
              <div className="grid gap-2">
                <div className="text-destructive text-center text-xs">{form.formState.errors.root.message}</div>
              </div>
            ) : null}

            <MutationStatusButton
              type="submit"
              idleVariant="primary"
              mutation={createPool}
              disabled={!form.formState.isValid}
            >
              Create option pool
            </MutationStatusButton>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
