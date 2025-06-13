"use client";
import { getFilteredRowModel, getSortedRowModel } from "@tanstack/react-table";
import Link from "next/link";
import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { formatISO } from "date-fns";
import DatePicker from "@/components/DatePicker";
import { CalendarDate, getLocalTimeZone, today } from "@internationalized/date";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import MainLayout from "@/components/layouts/Main";
import Placeholder from "@/components/Placeholder";
import Status from "@/components/Status";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { MutationStatusButton } from "@/components/MutationButton";
import { useCurrentCompany } from "@/global";
import { countries } from "@/models/constants";
import { DocumentTemplateType, PayRateType, trpc } from "@/trpc/client";
import { formatDate } from "@/utils/time";
import { UserPlus, Users } from "lucide-react";
import TemplateSelector from "@/app/document_templates/TemplateSelector";
import FormFields from "./FormFields";
import { DEFAULT_WORKING_HOURS_PER_WEEK } from "@/models";
import { Switch } from "@/components/ui/switch";

const schema = z.object({
  email: z.string().email(),
  payRateType: z.nativeEnum(PayRateType),
  payRateInSubunits: z.number(),
  hoursPerWeek: z.number().nullable(),
  role: z.string(),
  startDate: z.instanceof(CalendarDate),
  documentTemplateId: z.string(),
  contractSignedElsewhere: z.boolean().default(false),
});

export default function PeoplePage() {
  const company = useCurrentCompany();
  const router = useRouter();
  const [workers, { refetch }] = trpc.contractors.list.useSuspenseQuery({ companyId: company.id });
  const [showInviteModal, setShowInviteModal] = useState(false);
  const lastContractor = workers[0];

  const form = useForm({
    defaultValues: {
      ...(lastContractor ? { payRateInSubunits: lastContractor.payRateInSubunits, role: lastContractor.role } : {}),
      payRateType: lastContractor?.payRateType ?? PayRateType.Hourly,
      hoursPerWeek: lastContractor?.hoursPerWeek ?? DEFAULT_WORKING_HOURS_PER_WEEK,
      startDate: today(getLocalTimeZone()),
      contractSignedElsewhere: false,
    },
    resolver: zodResolver(schema),
  });

  const trpcUtils = trpc.useUtils();
  const saveMutation = trpc.contractors.create.useMutation({
    onSuccess: async (data) => {
      await refetch();
      await trpcUtils.documents.list.invalidate();
      setShowInviteModal(false);
      form.reset();
      if (data.documentId)
        router.push(`/documents?${new URLSearchParams({ sign: data.documentId.toString(), next: "/people" })}`);
    },
  });
  const submit = form.handleSubmit((values) => {
    saveMutation.mutate({
      companyId: company.id,
      ...values,
      startedAt: formatISO(values.startDate.toDate(getLocalTimeZone())),
    });
  });

  const columnHelper = createColumnHelper<(typeof workers)[number]>();
  const columns = useMemo(
    () => [
      columnHelper.accessor(
        (row) => {
          const firstName = row.user.legalName || "";
          const lastName = row.user.preferredName || "";
          return `${firstName} ${lastName}`.trim() || row.user.name || "—";
        },
        {
          id: "user_name",
          header: "Name",
          cell: (info) => {
            const content = info.getValue();
            return (
              <Link href={`/people/${info.row.original.user.id}`} className="after:absolute after:inset-0">
                {content}
              </Link>
            );
          },
        },
      ),
      columnHelper.accessor("role", {
        header: "Role",
        cell: (info) => info.getValue() || "N/A",
        meta: { filterOptions: Array.from(new Set(workers.map((worker) => worker.role))) },
      }),
      columnHelper.simple("user.countryCode", "Country", (v) => v && countries.get(v)),
      columnHelper.accessor((row) => (row.endedAt ? "Alumni" : row.startedAt > new Date() ? "Onboarding" : "Active"), {
        header: "Status",
        meta: { filterOptions: ["Active", "Onboarding", "Alumni"] },
        cell: (info) =>
          info.row.original.endedAt ? (
            <Status variant="critical">Ended on {formatDate(info.row.original.endedAt)}</Status>
          ) : info.row.original.startedAt <= new Date() ? (
            <Status variant="success">Started on {formatDate(info.row.original.startedAt)}</Status>
          ) : info.row.original.user.onboardingCompleted ? (
            <Status variant="success">Starts on {formatDate(info.row.original.startedAt)}</Status>
          ) : info.row.original.user.invitationAcceptedAt ? (
            <Status variant="primary">In Progress</Status>
          ) : (
            <Status variant="primary">Invited</Status>
          ),
      }),
    ],
    [],
  );

  const table = useTable({
    columns,
    data: workers,
    initialState: {
      sorting: [{ id: "Status", desc: false }],
    },
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <MainLayout
      title="People"
      headerActions={
        workers.length === 0 ? (
          <Button size="small" variant="outline" onClick={() => setShowInviteModal(true)}>
            <UserPlus className="size-4" />
            Invite contractor
          </Button>
        ) : null
      }
    >
      {workers.length > 0 ? (
        <DataTable
          table={table}
          searchColumn="user_name"
          actions={
            <Button size="small" variant="outline" onClick={() => setShowInviteModal(true)}>
              <UserPlus className="size-4" />
              Invite contractor
            </Button>
          }
        />
      ) : (
        <Placeholder icon={Users}>Contractors will show up here.</Placeholder>
      )}
      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Who's joining?</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={(e) => void submit(e)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" placeholder="Contractor's email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <DatePicker {...field} label="Start date" granularity="day" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormFields />

              <FormField
                control={form.control}
                name="contractSignedElsewhere"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        label="Already signed contract elsewhere"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {!form.watch("contractSignedElsewhere") && (
                <FormField
                  control={form.control}
                  name="documentTemplateId"
                  render={({ field }) => <TemplateSelector type={DocumentTemplateType.ConsultingContract} {...field} />}
                />
              )}
              <div className="flex flex-col items-end space-y-2">
                <MutationStatusButton mutation={saveMutation} type="submit">
                  Send invite
                </MutationStatusButton>
                {saveMutation.isError ? <div className="text-red text-sm">{saveMutation.error.message}</div> : null}
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
