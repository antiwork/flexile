"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDate, getLocalTimeZone, today } from "@internationalized/date";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { DashboardHeader } from "@/components/DashboardHeader";
import DatePicker from "@/components/DatePicker";
import { MutationStatusButton } from "@/components/MutationButton";
import NumberInput from "@/components/NumberInput";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentCompany } from "@/global";
import { trpc } from "@/trpc/client";

// TODO (techdebt): Track policy drift - the 10-day rule is enforced here on the client
// but may also be enforced on the server. We should ensure consistency
// between client and server validation to avoid user experience issues.
const formSchema = z.object({
  totalAmountInUsd: z.number().min(0.01, "Amount must be at least $0.01"),
  dividendsIssuanceDate: z.instanceof(CalendarDate, { message: "This field is required." }).refine(
    (date) => {
      const todayDate = today(getLocalTimeZone());
      const tenDaysFromNow = todayDate.add({ days: 10 });
      return date.compare(tenDaysFromNow) >= 0;
    },
    { message: "Dividend issuance date must be at least 10 days in the future" },
  ),
  returnOfCapital: z.boolean().default(false),
  investorReleaseForm: z.boolean().default(false),
  investorDetails: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function NewDividendComputation() {
  const company = useCurrentCompany();
  const router = useRouter();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      totalAmountInUsd: 0,
      dividendsIssuanceDate: today(getLocalTimeZone()).add({ days: 10 }),
      returnOfCapital: false,
      investorReleaseForm: false,
      investorDetails: "",
    },
  });

  const createDividendComputation = trpc.dividendComputations.create.useMutation();

  const createMutation = useMutation({
    mutationFn: async (values: FormData) => {
      const result = await createDividendComputation.mutateAsync({
        companyId: company.externalId,
        totalAmountInUsd: values.totalAmountInUsd,
        dividendsIssuanceDate: values.dividendsIssuanceDate.toString(),
        returnOfCapital: values.returnOfCapital,
        investorReleaseForm: values.investorReleaseForm,
        investorDetails: values.investorDetails || "",
      });

      router.push(`/equity/dividend_computations/${result.id}`);
    },
  });

  const submit = form.handleSubmit((data) => {
    createMutation.mutate(data);
  });

  return (
    <>
      <DashboardHeader
        title="Create Dividend Computation"
        headerActions={
          <Button variant="outline" asChild>
            <Link href="/equity/dividend_rounds">Cancel</Link>
          </Button>
        }
      />

      <div className="mx-4 max-w-2xl">
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h3 className="mb-2 text-sm font-medium text-amber-800">About Dividend Computations</h3>
          <p className="text-sm text-amber-700">
            This tool will calculate dividend distributions for all eligible shareholders based on their share
            ownership. You'll be able to review all calculations before finalizing the dividend round.
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={(e) => void submit(e)} className="grid gap-6">
            <FormField
              control={form.control}
              name="totalAmountInUsd"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Total Dividend Amount</FormLabel>
                  <FormControl>
                    <NumberInput {...field} prefix="$" placeholder="0.00" className="text-lg" />
                  </FormControl>
                  <FormMessage />
                  <p className="text-muted-foreground text-sm">Total amount to be distributed among all shareholders</p>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dividendsIssuanceDate"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <DatePicker
                      {...field}
                      label="Dividend Issuance Date"
                      granularity="day"
                      minValue={today(getLocalTimeZone())}
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-muted-foreground text-sm">
                    The date when dividends will be issued to shareholders
                  </p>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="returnOfCapital"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Return of Capital</FormLabel>
                    <p className="text-muted-foreground text-sm">
                      Mark this dividend as a return of capital for tax purposes
                    </p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="investorReleaseForm"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Investor Release Form</FormLabel>
                    <p className="text-muted-foreground text-sm">
                      Require investors to sign a release form before receiving dividends
                    </p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="investorDetails"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Investor Details</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Optional details to include in investor communications..."
                      className="min-h-[100px]"
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-muted-foreground text-sm">
                    Rich text details that will be included in investor notifications
                  </p>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-6">
              <Button variant="outline" type="button" asChild>
                <Link href="/equity/dividend_rounds">Cancel</Link>
              </Button>
              <MutationStatusButton type="submit" mutation={createMutation} loadingText="Creating computation...">
                Create Computation
              </MutationStatusButton>
            </div>
          </form>
        </Form>
      </div>
    </>
  );
}
