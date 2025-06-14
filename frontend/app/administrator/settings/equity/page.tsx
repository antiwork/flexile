"use client";

import { useQueryClient } from "@tanstack/react-query";
import { MutationStatusButton } from "@/components/MutationButton";
import NumberInput from "@/components/NumberInput";
import { useCurrentCompany } from "@/global";
import { trpc } from "@/trpc/client";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";

const formSchema = z.object({
  sharePriceInUsd: z.number().min(0),
  fmvPerShareInUsd: z.number().min(0),
  conversionSharePriceUsd: z.number().min(0),
});

export default function Equity() {
  const company = useCurrentCompany();
  const utils = trpc.useUtils();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ...(company.sharePriceInUsd ? { sharePriceInUsd: Number(company.sharePriceInUsd) } : {}),
      ...(company.exercisePriceInUsd ? { fmvPerShareInUsd: Number(company.exercisePriceInUsd) } : {}),
      ...(company.conversionSharePriceUsd ? { conversionSharePriceUsd: Number(company.conversionSharePriceUsd) } : {}),
    },
  });

  const updateSettings = trpc.companies.update.useMutation({
    onSuccess: async () => {
      await utils.companies.settings.invalidate();
      await queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      setTimeout(() => updateSettings.reset(), 2000);
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
      <Form {...form}>
        <form className="grid gap-8" onSubmit={(e) => void submit(e)}>
          <hgroup>
            <h2 className="mb-1 text-xl font-medium">Equity</h2>
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
    </div>
  );
}
