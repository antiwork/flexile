"use client";
import { utc } from "@date-fns/utc";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/16/solid";
import { EnvelopeIcon, UsersIcon } from "@heroicons/react/24/outline";
import { useMutation } from "@tanstack/react-query";
import { startOfMonth, startOfQuarter, startOfYear, subMonths, subQuarters, subYears } from "date-fns";
import { useParams, useRouter } from "next/navigation";
import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import MainLayout from "@/components/layouts/Main";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import MutationButton, { MutationStatusButton } from "@/components/MutationButton";
import { Editor as RichTextEditor } from "@/components/RichText";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useCurrentCompany } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { assertDefined } from "@/utils/assert";
import { pluralize } from "@/utils/pluralize";
import { formatServerDate } from "@/utils/time";
import FinancialOverview, { formatPeriod } from "./FinancialOverview";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import ComboBox from "@/components/ComboBox";

const formSchema = z.object({
  title: z.string().trim().min(1, "This field is required."),
  body: z.string().regex(/>\w/u, "This field is required."),
  period: z.string(),
  videoUrl: z.string().nullable(),
  showRevenue: z.boolean(),
  showNetIncome: z.boolean(),
});
type CompanyUpdate = RouterOutput["companyUpdates"]["get"];
const Edit = ({ update }: { update?: CompanyUpdate }) => {
  const { id } = useParams<{ id?: string }>();
  const company = useCurrentCompany();
  const router = useRouter();
  const year = new Date().getFullYear();
  const trpcUtils = trpc.useUtils();
  const [financialReports] = trpc.financialReports.get.useSuspenseQuery({
    years: [year, year - 1, year - 2],
    companyId: company.id,
  });

  const first = startOfMonth(new Date(), { in: utc });
  const lastMonth = formatServerDate(startOfMonth(subMonths(first, 1)));
  const lastQuarter = formatServerDate(startOfQuarter(subQuarters(first, 1)));
  const lastYear = formatServerDate(startOfYear(subYears(first, 1)));

  const periodOptions = [
    { label: "None", value: "", period: null, periodStartedOn: null },
    {
      label: `${formatPeriod("month", lastMonth)} (Last month)`,
      value: "month",
      period: "month",
      periodStartedOn: lastMonth,
    },
    {
      label: `${formatPeriod("quarter", lastQuarter)} (Last quarter)`,
      value: "quarter",
      period: "quarter",
      periodStartedOn: lastQuarter,
    },
    {
      label: `${formatPeriod("year", lastYear)} (Last year)`,
      value: "year",
      period: "year",
      periodStartedOn: lastYear,
    },
  ] satisfies (Pick<CompanyUpdate, "period" | "periodStartedOn"> & { label: string; value: string })[];
  const existingPeriodOption = update
    ? periodOptions.find((o) => o.period === update.period && o.periodStartedOn === update.periodStartedOn)
    : null;
  if (update?.period && update.periodStartedOn && !existingPeriodOption) {
    periodOptions.push({
      label: formatPeriod(update.period, update.periodStartedOn),
      value: "existing",
      period: update.period,
      periodStartedOn: update.periodStartedOn,
    });
  }

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: update?.title ?? "",
      body: update?.body ?? "",
      videoUrl: update?.videoUrl ?? "",
      showRevenue: update?.showRevenue ?? false,
      showNetIncome: update?.showNetIncome ?? false,
      period: update ? (existingPeriodOption?.value ?? "existing") : "",
    },
  });
  const selectedPeriodOption = assertDefined(periodOptions.find((o) => o.value === form.watch("period")));
  const [modalOpen, setModalOpen] = useState(false);
  const recipientCount = (company.contractorCount ?? 0) + (company.investorCount ?? 0);

  const createMutation = trpc.companyUpdates.create.useMutation();
  const updateMutation = trpc.companyUpdates.update.useMutation();
  const publishMutation = trpc.companyUpdates.publish.useMutation();
  const saveMutation = useMutation({
    mutationFn: async ({ values, preview }: { values: z.infer<typeof formSchema>; preview: boolean }) => {
      const data = {
        companyId: company.id,
        ...values,
        period: selectedPeriodOption.period,
        periodStartedOn: selectedPeriodOption.periodStartedOn,
      };
      let id;
      if (update) {
        id = update.id;
        await updateMutation.mutateAsync({ ...data, id });
      } else {
        id = await createMutation.mutateAsync(data);
      }
      if (!preview && !update?.sentAt) await publishMutation.mutateAsync({ companyId: company.id, id });
      void trpcUtils.companyUpdates.list.invalidate();
      if (preview) {
        router.replace(`/updates/company/${id}/edit`);
        window.open(`/updates/company/${id}`, "_blank");
      } else {
        router.push(`/updates/company/${id}`);
      }
    },
  });

  const submit = form.handleSubmit(async (values, event) => {
    if (event?.target instanceof HTMLElement && event.target.id === "preview") {
      return saveMutation.mutateAsync({ preview: true, values });
    }
    setModalOpen(true);
  });

  return (
    <Form {...form}>
      <form onSubmit={(e) => void submit(e)}>
        <MainLayout
          title={id ? "Edit company update" : "New company update"}
          headerActions={
            update?.sentAt ? (
              <Button type="submit">
                <EnvelopeIcon className="size-4" />
                Update
              </Button>
            ) : (
              <>
                <MutationStatusButton
                  type="submit"
                  mutation={saveMutation}
                  id="preview"
                  idleVariant="outline"
                  loadingText="Saving..."
                >
                  <ArrowTopRightOnSquareIcon className="size-4" />
                  Preview
                </MutationStatusButton>
                <Button type="submit">
                  <EnvelopeIcon className="size-4" />
                  Publish
                </Button>
              </>
            )
          }
        >
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto]">
            <div className="grid gap-3">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="period"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Financial overview</FormLabel>
                    <FormControl>
                      <ComboBox {...field} options={periodOptions} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {selectedPeriodOption.period && selectedPeriodOption.periodStartedOn ? (
                <FinancialOverview
                  financialReports={financialReports}
                  period={selectedPeriodOption.period}
                  periodStartedOn={selectedPeriodOption.periodStartedOn}
                  revenueTitle={
                    <FormField
                      control={form.control}
                      name="showRevenue"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} label="Revenue" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  }
                  netIncomeTitle={
                    <FormField
                      control={form.control}
                      name="showNetIncome"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} label="Net income" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  }
                />
              ) : null}
              <FormField
                control={form.control}
                name="body"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Update</FormLabel>
                    <FormControl>
                      <RichTextEditor {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="videoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Video URL (optional)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="flex flex-col gap-2">
              <div className="mb-1 text-xs text-gray-500 uppercase">Recipients ({recipientCount.toLocaleString()})</div>
              {company.investorCount ? (
                <div className="flex items-center gap-2">
                  <UsersIcon className="size-4" />
                  <span>
                    {company.investorCount.toLocaleString()} {pluralize("investor", company.investorCount)}
                  </span>
                </div>
              ) : null}
              {company.contractorCount ? (
                <div className="flex items-center gap-2">
                  <UsersIcon className="size-4" />
                  <span>
                    {company.contractorCount.toLocaleString()} active {pluralize("contractor", company.contractorCount)}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
          <Dialog open={modalOpen} onOpenChange={setModalOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Publish update?</DialogTitle>
              </DialogHeader>
              {update?.sentAt ? (
                <p>Your update will be visible in Flexile. No new emails will be sent.</p>
              ) : (
                <p>Your update will be emailed to {recipientCount.toLocaleString()} stakeholders.</p>
              )}
              <DialogFooter>
                <div className="grid auto-cols-fr grid-flow-col items-center gap-3">
                  <Button variant="outline" onClick={() => setModalOpen(false)}>
                    No, cancel
                  </Button>
                  <MutationButton
                    mutation={saveMutation}
                    param={{ values: form.getValues(), preview: false }}
                    loadingText="Sending..."
                  >
                    Yes, {update?.sentAt ? "update" : "publish"}
                  </MutationButton>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </MainLayout>
      </form>
    </Form>
  );
};

export default Edit;
