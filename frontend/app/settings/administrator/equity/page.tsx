"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Info } from "lucide-react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { linkClasses } from "@/components/Link";
import { MutationStatusButton } from "@/components/MutationButton";
import NumberInput from "@/components/NumberInput";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
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
  const [settings] = trpc.companies.settings.useSuspenseQuery({ companyId: company.id });
  const utils = trpc.useUtils();
  const queryClient = useQueryClient();
  const requiresCompanyName = !settings.name || settings.name.trim().length === 0;

  const toggleMutation = trpc.companies.update.useMutation({
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

  const form = useForm({
    resolver: zodResolver(formSchema),
    values: {
      sharePriceInUsd: Number(company.sharePriceInUsd),
      fmvPerShareInUsd: Number(company.exercisePriceInUsd),
      conversionSharePriceUsd: Number(company.conversionSharePriceUsd),
    },
    disabled: requiresCompanyName,
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
    <div className="grid gap-8">
      <hgroup>
        <h2 className="mb-1 text-3xl font-bold">Equity</h2>
        <p className="text-muted-foreground text-base">
          Manage your company ownership, including cap table, option pools, and grants.
        </p>
      </hgroup>
      {requiresCompanyName ? (
        <Alert>
          <Info className="my-auto size-4" />
          <AlertDescription>
            Please{" "}
            <Link href="/settings/administrator/details" className={linkClasses}>
              add your company name
            </Link>{" "}
            in order to manage equity settings.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className={`space-y-6 ${requiresCompanyName ? "opacity-50" : ""}`}>
        <div>
          <h2 className="text-base font-semibold">Settings</h2>
          <div className="bg-border mt-2 h-px" />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 space-y-1">
              <Label htmlFor="enable-equity-switch" className="cursor-pointer">
                Enable equity
              </Label>
              <div className="text-muted-foreground text-sm">
                Unlock cap table, grants, and pools across your workspace.
              </div>
            </div>
            <Switch
              id="enable-equity-switch"
              checked={company.equityEnabled}
              onCheckedChange={(checked) => {
                toggleMutation.mutate({
                  companyId: company.id,
                  equityEnabled: checked,
                });
              }}
              disabled={toggleMutation.isPending || requiresCompanyName}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex-1 space-y-1">
              <Label htmlFor="exercise-requests-switch" className="cursor-pointer">
                Exercise requests
              </Label>
              <div className="text-muted-foreground text-sm">Allow investors to exercise their vested options.</div>
            </div>
            <Switch
              id="exercise-requests-switch"
              checked={company.jsonData?.flags.includes("option_exercising") ?? false}
              onCheckedChange={(checked) => {
                const currentFlags = company.jsonData?.flags || [];
                const newFlags = checked
                  ? [...new Set([...currentFlags, "option_exercising"])]
                  : currentFlags.filter((flag) => flag !== "option_exercising");

                toggleMutation.mutate({
                  companyId: company.id,
                  jsonData: { flags: newFlags },
                });
              }}
              disabled={toggleMutation.isPending || !company.equityEnabled}
            />
          </div>
        </div>
      </div>

      {company.equityEnabled ? (
        <div className={`space-y-4 ${requiresCompanyName ? "opacity-50" : ""}`}>
          <hgroup>
            <h2 className="text-base font-semibold">Equity value</h2>
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
                  <MutationStatusButton
                    type="submit"
                    size="small"
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
