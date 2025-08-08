"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDate, getLocalTimeZone, today } from "@internationalized/date";
import { useQueryClient } from "@tanstack/react-query";
import { getFilteredRowModel, getSortedRowModel } from "@tanstack/react-table";
import { formatISO } from "date-fns";
import { LinkIcon, Plus, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { type Dispatch, type SetStateAction, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import TemplateSelector from "@/app/(dashboard)/document_templates/TemplateSelector";
import { DashboardHeader } from "@/components/DashboardHeader";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import DatePicker from "@/components/DatePicker";
import { MutationStatusButton } from "@/components/MutationButton";
import Placeholder from "@/components/Placeholder";
import Status from "@/components/Status";
import TableSkeleton from "@/components/TableSkeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useCurrentCompany } from "@/global";
import { countries } from "@/models/constants";
import { DocumentTemplateType, PayRateType, trpc } from "@/trpc/client";
import { formatDate } from "@/utils/time";
import { useIsMobile } from "@/utils/use-mobile";
import FormFields, { schema as formSchema } from "./FormFields";
import InviteLinkModal from "./InviteLinkModal";

const schema = formSchema.extend({
  email: z.string().email(),
  startDate: z.instanceof(CalendarDate),
  documentTemplateId: z.string(),
  contractSignedElsewhere: z.boolean().default(false),
});

const removeMailtoPrefix = (email: string) => email.replace(/^mailto:/iu, "");

export default function PeoplePage() {
  const company = useCurrentCompany();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { data: workers = [], isLoading, refetch } = trpc.contractors.list.useQuery({ companyId: company.id });
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showInviteLinkModal, setShowInviteLinkModal] = useState(false);

  const lastContractor = workers[0];

  const form = useForm({
    values: {
      email: "",
      role: lastContractor?.role ?? "",
      documentTemplateId: "",
      payRateType: lastContractor?.payRateType ?? PayRateType.Hourly,
      payRateInSubunits: lastContractor?.payRateInSubunits ?? null,
      startDate: today(getLocalTimeZone()),
      contractSignedElsewhere: lastContractor?.contractSignedElsewhere ?? false,
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
      await queryClient.invalidateQueries({ queryKey: ["currentUser"] });

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
      columnHelper.accessor("user.name", {
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
    <>
      <DashboardHeader
        title="People"
        headerActions={
          workers.length === 0 ? (
            <ActionPanel setShowInviteLinkModal={setShowInviteLinkModal} setShowInviteModal={setShowInviteModal} />
          ) : null
        }
      />

      {isLoading ? (
        <TableSkeleton columns={4} />
      ) : workers.length > 0 ? (
        <DataTable
          table={table}
          searchColumn="user_name"
          actions={
            <ActionPanel setShowInviteLinkModal={setShowInviteLinkModal} setShowInviteModal={setShowInviteModal} />
          }
        />
      ) : (
        <div className="mx-4">
          <Placeholder icon={Users}>Contractors will show up here.</Placeholder>
        </div>
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
      <InviteLinkModal open={showInviteLinkModal} onOpenChange={setShowInviteLinkModal} />
    </>
  );
}

const ActionPanel = ({
  setShowInviteLinkModal,
  setShowInviteModal,
}: {
  setShowInviteLinkModal: Dispatch<SetStateAction<boolean>>;
  setShowInviteModal: Dispatch<SetStateAction<boolean>>;
}) => {
  const isMobile = useIsMobile();
  // Ensures smooth transition from Action Panel to Invite dialog, avoiding flicker from suspense query in TemplateSelector
  const debounce = (fn: () => void, delay: number) => {
    let timeout: NodeJS.Timeout;
    return () => {
      clearTimeout(timeout);
      timeout = setTimeout(fn, delay);
    };
  };
  const handleInviteClick = () => {
    setShowInviteModal(true);
  };
  const handleInviteLinkClick = () => {
    setShowInviteLinkModal(true);
  };
  const handleMobileInviteClick = debounce(handleInviteClick, 200);

  return isMobile ? (
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
          <DialogClose asChild onClick={handleInviteLinkClick}>
            <Button size="small" variant="outline">
              <LinkIcon className="size-4" />
              Invite link
            </Button>
          </DialogClose>
          <DialogClose asChild onClick={handleMobileInviteClick}>
            <Button size="small">
              <Plus className="size-4" />
              Add contractor
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  ) : (
    <div className="flex flex-row gap-2">
      <Button size="small" variant="outline" onClick={handleInviteLinkClick}>
        <LinkIcon className="size-4" />
        Invite link
      </Button>
      <Button size="small" onClick={handleInviteClick}>
        <Plus className="size-4" />
        Add contractor
      </Button>
    </div>
  );
};
