"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { MutationStatusButton } from "@/components/MutationButton";
import NumberInput from "@/components/NumberInput";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { useCurrentCompany } from "@/global";
import { trpc } from "@/trpc/client";

const formSchema = z.object({
  sharePriceInUsd: z.number().min(0),
  fmvPerShareInUsd: z.number().min(0),
  conversionSharePriceUsd: z.number().min(0),
});

export default function Equity() {
  const company = useCurrentCompany();
  const utils = trpc.useUtils();
  const queryClient = useQueryClient();
  const [localEquityEnabled, setLocalEquityEnabled] = useState(company.equityEnabled);

  // Separate mutation for the toggle
  const updateEquityEnabled = trpc.companies.update.useMutation({
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

  const handleToggle = async (checked: boolean) => {
    setLocalEquityEnabled(checked);
    await updateEquityEnabled.mutateAsync({
      companyId: company.id,
      equityEnabled: checked,
    });
  };

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ...(company.sharePriceInUsd ? { sharePriceInUsd: Number(company.sharePriceInUsd) } : {}),
      ...(company.exercisePriceInUsd ? { fmvPerShareInUsd: Number(company.exercisePriceInUsd) } : {}),
      ...(company.conversionSharePriceUsd ? { conversionSharePriceUsd: Number(company.conversionSharePriceUsd) } : {}),
    },
  });

  const submit = form.handleSubmit((values) =>
    updateSettings.mutateAsync({
      companyId: company.id,
      sharePriceInUsd: values.sharePriceInUsd.toString(),
      fmvPerShareInUsd: values.fmvPerShareInUsd.toString(),
      conversionSharePriceUsd: values.conversionSharePriceUsd.toString(),
    }),
  );

  return (
    <div className="grid gap-8">
      <hgroup>
        <h2 className="mb-1 text-3xl font-bold">Equity</h2>
        <p className="text-muted-foreground text-base">
          Manage your company ownership, including cap table, option pools, and grants.
        </p>
      </hgroup>
      <div className="bg-card rounded-lg border p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold">Enable equity</div>
            <div className="text-muted-foreground text-sm">
              Unlock cap table, grants, and pools across your workspace.
            </div>
          </div>
          <Switch
            checked={localEquityEnabled}
            onCheckedChange={(checked) => {
              void handleToggle(checked);
            }}
            aria-label="Enable equity"
            disabled={updateEquityEnabled.isPending}
          />
        </div>
      </div>
      {localEquityEnabled ? (
        <Form {...form}>
          <form className="grid gap-8" onSubmit={(e) => void submit(e)}>
            <hgroup>
              <h2 className="mb-1 text-3xl font-bold">Equity value</h2>
              <p className="text-muted-foreground text-base">
                These details will be used for equity-related calculations and reporting.
              </p>
            </hgroup>
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
      ) : null}
    </div>
  );
}
