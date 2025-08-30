"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useExerciseDataConfig } from "@/app/(dashboard)/equity/options";
import { MutationStatusButton } from "@/components/MutationButton";
import NumberInput from "@/components/NumberInput";
import { Editor as RichTextEditor } from "@/components/RichText";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { useCurrentCompany } from "@/global";
import { trpc } from "@/trpc/client";

const formSchema = z.object({
  sharePriceInUsd: z.number().min(0),
  fmvPerShareInUsd: z.number().min(0),
  conversionSharePriceUsd: z.number().min(0),
  exerciseNotice: z.string().nullable(),
});

export default function Equity() {
  const company = useCurrentCompany();
  const utils = trpc.useUtils();
  const queryClient = useQueryClient();
  const [localEquityEnabled, setLocalEquityEnabled] = useState(company.equityEnabled);
  const [localOptionExercisingEnabled, setLocalOptionExercisingEnabled] = useState(company.optionExercisingEnabled);
  const { data: exerciseData } = useQuery(useExerciseDataConfig());

  // Separate mutation for the equity toggle
  const updateEquityEnabled = trpc.companies.update.useMutation({
    onSuccess: async () => {
      await utils.companies.settings.invalidate();
      await queryClient.invalidateQueries({ queryKey: ["currentUser"] });
    },
  });

  // Separate mutation for the option exercising toggle
  const updateOptionExercisingEnabled = trpc.companies.update.useMutation({
    onSuccess: async () => {
      await utils.companies.settings.invalidate();
      await queryClient.invalidateQueries({ queryKey: ["currentUser"] });
    },
  });

  // Mutation for the form
  const updateSettings = trpc.companies.update.useMutation({
    onSuccess: async () => {
      await utils.companies.settings.invalidate();
      await queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      setTimeout(() => updateSettings.reset(), 2000);
    },
  });

  const handleEquityToggle = async (checked: boolean) => {
    setLocalEquityEnabled(checked);
    await updateEquityEnabled.mutateAsync({
      companyId: company.id,
      equityEnabled: checked,
    });
  };

  const handleOptionExercisingToggle = async (checked: boolean) => {
    setLocalOptionExercisingEnabled(checked);
    await updateOptionExercisingEnabled.mutateAsync({
      companyId: company.id,
      optionExercisingEnabled: checked,
    });
  };

  const form = useForm({
    resolver: zodResolver(formSchema),
    values: {
      sharePriceInUsd: Number(company.sharePriceInUsd),
      fmvPerShareInUsd: Number(company.exercisePriceInUsd),
      conversionSharePriceUsd: Number(company.conversionSharePriceUsd),
      exerciseNotice: exerciseData?.exercise_notice ?? null,
    },
  });

  const submit = form.handleSubmit((values) =>
    updateSettings.mutateAsync({
      companyId: company.id,
      ...values,
      sharePriceInUsd: values.sharePriceInUsd.toString(),
      fmvPerShareInUsd: values.fmvPerShareInUsd.toString(),
      conversionSharePriceUsd: values.conversionSharePriceUsd.toString(),
    }),
  );

  return (
    <div className="max-w-4xl space-y-8 max-md:mb-10">
      <hgroup>
        <h2 className="mb-1 text-3xl font-bold">Equity</h2>
        <p className="text-muted-foreground text-base">
          Manage your company ownership, including cap table, option pools, and grants.
        </p>
      </hgroup>

      {/* Settings Section */}
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Settings</h2>
          <div className="bg-border mt-2 h-px"></div>
        </div>

        <div className="space-y-6">
          {/* Enable Equity Setting */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="font-medium">Enable equity</div>
              <div className="text-muted-foreground text-sm">
                Unlock cap table, grants, and pools across your workspace.
              </div>
            </div>
            <Switch
              checked={localEquityEnabled}
              onCheckedChange={(checked) => {
                void handleEquityToggle(checked);
              }}
              aria-label="Enable equity"
              disabled={updateEquityEnabled.isPending}
            />
          </div>

          {/* Option Exercising Setting - Always visible, toggle only when equity enabled */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="font-medium">Exercise requests</div>
              <div className="text-muted-foreground text-sm">Allow investors to exercise their vested options.</div>
            </div>
            {localEquityEnabled ? (
              <Switch
                checked={localOptionExercisingEnabled}
                onCheckedChange={(checked) => {
                  void handleOptionExercisingToggle(checked);
                }}
                aria-label="Enable option exercising"
                disabled={updateOptionExercisingEnabled.isPending}
              />
            ) : null}
          </div>
        </div>
      </div>

      {/* Equity Value Section - Only shown when equity is enabled */}
      {localEquityEnabled ? (
        <div className="space-y-6">
          <hgroup>
            <h2 className="text-lg font-semibold">Equity value</h2>
            <div className="bg-border mt-2 h-px"></div>
          </hgroup>

          <div>
            <p className="text-muted-foreground mb-6 text-sm">
              These details will be used for equity-related calculations and reporting.
            </p>

            <Form {...form}>
              <form className="grid gap-6" onSubmit={(e) => void submit(e)}>
                <div className="grid gap-4">
                  <FormField
                    control={form.control}
                    name="sharePriceInUsd"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current share price (USD)</FormLabel>
                        <FormControl>
                          <NumberInput {...field} decimal minimumFractionDigits={2} prefix="$" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="fmvPerShareInUsd"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current 409A valuation (USD per share)</FormLabel>
                        <FormControl>
                          <NumberInput {...field} decimal minimumFractionDigits={2} prefix="$" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="conversionSharePriceUsd"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Conversion share price (USD)</FormLabel>
                        <FormControl>
                          <NumberInput {...field} decimal minimumFractionDigits={2} prefix="$" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {exerciseData && localOptionExercisingEnabled ? (
                    <FormField
                      control={form.control}
                      name="exerciseNotice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Exercise notice</FormLabel>
                          <FormControl>
                            <RichTextEditor {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  ) : null}
                  <MutationStatusButton
                    type="submit"
                    className="w-fit"
                    mutation={updateSettings}
                    loadingText="Saving..."
                    successText="Changes saved"
                  >
                    Save changes
                  </MutationStatusButton>
                </div>
              </form>
            </Form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
