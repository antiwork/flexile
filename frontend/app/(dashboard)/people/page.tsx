"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDate, getLocalTimeZone, today } from "@internationalized/date";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getFilteredRowModel, getSortedRowModel } from "@tanstack/react-table";
import { formatISO } from "date-fns";
import { LinkIcon, Plus, Users } from "lucide-react";
import Link from "next/link";
import React, { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { DashboardHeader } from "@/components/DashboardHeader";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import DatePicker from "@/components/DatePicker";
import { MutationStatusButton } from "@/components/MutationButton";
import Placeholder from "@/components/Placeholder";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DialogStack,
  DialogStackBody,
  DialogStackContent,
  DialogStackFooter,
  DialogStackHeader,
  DialogStackPrevious,
  DialogStackTitle,
} from "@/components/ui/dialog-stack";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useCurrentCompany } from "@/global";
import { countries } from "@/models/constants";
import type { RouterOutput } from "@/trpc";
import { PayRateType, trpc } from "@/trpc/client";
import { request } from "@/utils/request";
import { company_workers_path } from "@/utils/routes";
import { formatDate, serverDateToLocal } from "@/utils/time";
import { useIsMobile } from "@/utils/use-mobile";
import NewDocumentField, { schema as documentSchema } from "../documents/NewDocumentField";
import FormFields, { schema as formSchema } from "./FormFields";
import InviteLinkModal from "./InviteLinkModal";

const removeMailtoPrefix = (email: string) => email.replace(/^mailto:/iu, "");
const getStatusLabel = (contractor: RouterOutput["contractors"]["list"][number]) => {
  const { endedAt, startedAt, user } = contractor;
  if (endedAt) {
    return `Ended on ${formatDate(serverDateToLocal(endedAt))}`;
  } else if (startedAt <= new Date()) {
    return `Started on ${formatDate(serverDateToLocal(startedAt))}`;
  } else if (user.onboardingCompleted) {
    return `Starts on ${formatDate(serverDateToLocal(startedAt))}`;
  } else if (user.invitationAcceptedAt) {
    return "In Progress";
  }
  return "Invited";
};

export default function PeoplePage() {
  const company = useCurrentCompany();
  const { data: workers = [], isLoading } = trpc.contractors.list.useQuery({ companyId: company.id });
  const isMobile = useIsMobile();

  const columnHelper = createColumnHelper<(typeof workers)[number]>();
  const desktopColumns = useMemo(
    () => [
      columnHelper.accessor("user.name", {
        id: "userName",
        header: "Name",
        cell: (info) => {
          const content = info.getValue();
          return (
            <Link href={`/people/${info.row.original.user.id}`} className="after:absolute after:inset-0">
              {content}
            </Link>
          );
        },
      }),
      columnHelper.accessor("role", {
        header: "Role",
        cell: (info) => info.getValue() || "N/A",
        meta: { filterOptions: [...new Set(workers.map((worker) => worker.role))] },
      }),
      columnHelper.simple("user.countryCode", "Country", (v) => v && countries.get(v)),
      columnHelper.accessor((row) => (row.endedAt ? "Alumni" : row.startedAt > new Date() ? "Onboarding" : "Active"), {
        id: "status",
        header: "Status",
        meta: { filterOptions: ["Active", "Onboarding", "Alumni"] },
        cell: (info) => getStatusLabel(info.row.original),
      }),
    ],
    [workers],
  );
  const mobileColumns = useMemo(
    () => [
      columnHelper.display({
        id: "nameRoleCountry",
        cell: (info) => {
          const person = info.row.original;
          return (
            <>
              <div>
                <div className="truncate text-base font-medium">{person.user.name}</div>
                <div className="truncate text-sm font-normal">{person.role}</div>
              </div>
              {person.user.countryCode ? (
                <div className="text-muted-foreground truncate text-sm font-normal">
                  {countries.get(person.user.countryCode)}
                </div>
              ) : null}
            </>
          );
        },
        meta: {
          cellClassName: "max-w-[50vw]",
        },
      }),

      columnHelper.display({
        id: "statusDisplay",
        cell: (info) => (
          <div className="flex h-full flex-col items-end justify-between">
            <div className="flex h-5 items-center justify-center">{getStatusLabel(info.row.original)}</div>
          </div>
        ),
      }),

      columnHelper.accessor((row) => (row.endedAt ? "Alumni" : row.startedAt > new Date() ? "Onboarding" : "Active"), {
        id: "status",
        header: "Status",
        meta: {
          filterOptions: ["Active", "Onboarding", "Alumni"],
          hidden: true,
        },
      }),

      columnHelper.accessor("user.name", {
        id: "userName",
        header: "Name",
        meta: {
          hidden: true,
        },
      }),

      columnHelper.accessor("role", {
        id: "role",
        header: "Role",
        meta: {
          filterOptions: [...new Set(workers.map((worker) => worker.role))],
          hidden: true,
        },
      }),
    ],
    [workers],
  );

  const columns = isMobile ? mobileColumns : desktopColumns;

  const table = useTable({
    columns,
    data: workers,
    initialState: {
      sorting: [{ id: "status", desc: false }],
    },
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <>
      <DashboardHeader
        title="People"
        headerActions={
          <>
            {isMobile && table.options.enableRowSelection ? (
              <button className="text-link" onClick={() => table.toggleAllRowsSelected(!table.getIsAllRowsSelected())}>
                {table.getIsAllRowsSelected() ? "Unselect all" : "Select all"}
              </button>
            ) : null}
            {workers.length === 0 && !isLoading ? <ActionPanel /> : null}
          </>
        }
      />

      {workers.length > 0 || isLoading ? (
        <DataTable
          table={table}
          searchColumn="userName"
          tabsColumn="status"
          actions={<ActionPanel />}
          isLoading={isLoading}
        />
      ) : (
        <div className="mx-4">
          <Placeholder icon={Users}>Contractors will show up here.</Placeholder>
        </div>
      )}
    </>
  );
}

const detailsSchema = formSchema.extend({
  email: z.string().email(),
  startDate: z.instanceof(CalendarDate),
});
const contractSchema = documentSchema.extend({
  contractSignedElsewhere: z.boolean().default(false),
});

const ActionPanel = () => {
  const company = useCurrentCompany();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showInviteLinkModal, setShowInviteLinkModal] = useState(false);
  const [step, setStep] = useState(0);

  const { data: workers = [], refetch } = trpc.contractors.list.useQuery({ companyId: company.id });
  const lastContractor = workers[0];

  const detailsForm = useForm({
    resolver: zodResolver(detailsSchema),
    values: {
      email: "",
      role: lastContractor?.role ?? "",
      payRateType: lastContractor?.payRateType ?? PayRateType.Hourly,
      payRateInSubunits: lastContractor?.payRateInSubunits ?? null,
      startDate: today(getLocalTimeZone()),
    },
    mode: "onChange",
  });

  const contractForm = useForm({
    resolver: zodResolver(contractSchema),
    values: {
      contractSignedElsewhere: lastContractor?.contractSignedElsewhere ?? false,
      contract: "",
    },
    mode: "onChange",
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const detailsValues = detailsForm.getValues();
      const contractValues = contractForm.getValues();
      const formData = new FormData();
      formData.append("contractor[email]", detailsValues.email);
      formData.append("contractor[started_at]", formatISO(detailsValues.startDate.toDate(getLocalTimeZone())));
      formData.append("contractor[pay_rate_in_subunits]", detailsValues.payRateInSubunits?.toString() ?? "");
      formData.append(
        "contractor[pay_rate_type]",
        detailsValues.payRateType === PayRateType.Hourly ? "hourly" : "project_based",
      );
      formData.append("contractor[role]", detailsValues.role);
      formData.append("contractor[contract_signed_elsewhere]", contractValues.contractSignedElsewhere.toString());
      formData.append("contractor[contract]", contractValues.contract);

      const response = await request({
        url: company_workers_path(company.id),
        method: "POST",
        accept: "json",
        assertOk: true,
        formData,
      });

      if (!response.ok) {
        const json = z.object({ error_message: z.string() }).parse(await response.json());
        throw new Error(json.error_message);
      }
    },
    onSuccess: async () => {
      await refetch();
      setShowInviteModal(false);
      detailsForm.reset();
      contractForm.reset();
      setStep(0);
      await queryClient.invalidateQueries({ queryKey: ["currentUser"] });
    },
  });

  const submitDetails = detailsForm.handleSubmit(() => setStep(1));
  const submitContract = contractForm.handleSubmit(() => inviteMutation.mutate());

  return (
    <>
      {isMobile ? (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="floating-action">
              <Plus />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Invite people to your workspace</DialogTitle>
            <DialogDescription className="sr-only">Invite people to your workspace</DialogDescription>
            <div className="flex flex-col gap-3">
              <DialogClose asChild onClick={() => setShowInviteLinkModal(true)}>
                <Button variant="outline">
                  <LinkIcon className="size-4" />
                  Invite link
                </Button>
              </DialogClose>
              <DialogClose asChild onClick={() => setShowInviteModal(true)}>
                <Button variant="primary">
                  <Plus className="size-4" />
                  Add contractor
                </Button>
              </DialogClose>
            </div>
          </DialogContent>
        </Dialog>
      ) : (
        <div className="flex flex-row gap-2">
          <Button variant="outline" onClick={() => setShowInviteLinkModal(true)}>
            <LinkIcon className="size-4" />
            Invite link
          </Button>
          <Button variant="primary" onClick={() => setShowInviteModal(true)}>
            <Plus className="size-4" />
            Add contractor
          </Button>
        </div>
      )}
      <DialogStack open={showInviteModal} onOpenChange={setShowInviteModal} activeIndex={step} setActiveIndex={setStep}>
        <DialogStackBody>
          <DialogStackContent>
            <DialogStackHeader>
              <DialogStackTitle>Who's joining?</DialogStackTitle>
            </DialogStackHeader>
            <Form {...detailsForm}>
              <form onSubmit={(e) => void submitDetails(e)} className="contents">
                <div className="grid h-auto gap-4 p-0.5">
                  <FormField
                    control={detailsForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="email"
                            placeholder="Contractor's email"
                            onChange={(e) => field.onChange(removeMailtoPrefix(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={detailsForm.control}
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
                </div>
                <DialogStackFooter>
                  <Button variant="primary" type="submit" disabled={!detailsForm.formState.isValid}>
                    Continue
                  </Button>
                </DialogStackFooter>
              </form>
            </Form>
          </DialogStackContent>
          <DialogStackContent>
            <DialogStackHeader>
              <DialogStackTitle>Add a contract</DialogStackTitle>
            </DialogStackHeader>
            <Form {...contractForm}>
              <form onSubmit={(e) => void submitContract(e)} className="contents">
                {!contractForm.watch("contractSignedElsewhere") && <NewDocumentField type="consulting_contract" />}

                <FormField
                  control={contractForm.control}
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
                {inviteMutation.isError ? <div className="text-red text-sm">{inviteMutation.error.message}</div> : null}
                <DialogStackFooter>
                  <DialogStackPrevious>
                    <Button variant="outline">Back</Button>
                  </DialogStackPrevious>
                  <MutationStatusButton
                    idleVariant="primary"
                    mutation={inviteMutation}
                    type="submit"
                    disabled={!contractForm.formState.isValid}
                  >
                    Send invite
                  </MutationStatusButton>
                </DialogStackFooter>
              </form>
            </Form>
          </DialogStackContent>
        </DialogStackBody>
      </DialogStack>
      <InviteLinkModal open={showInviteLinkModal} onOpenChange={setShowInviteLinkModal} />
    </>
  );
};
