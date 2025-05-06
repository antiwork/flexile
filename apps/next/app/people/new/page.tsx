"use client";
import { PaperAirplaneIcon } from "@heroicons/react/16/solid";
import { formatISO } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import TemplateSelector from "@/app/document_templates/TemplateSelector";
import { Input } from "@/components/ui/input";
import MainLayout from "@/components/layouts/Main";
import { MutationStatusButton } from "@/components/MutationButton";
import { Button } from "@/components/ui/button";
import { useCurrentCompany } from "@/global";
import { DocumentTemplateType, PayRateType, trpc } from "@/trpc/client";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import FormFields from "../FormFields";
import { DEFAULT_WORKING_HOURS_PER_WEEK } from "@/models";
const schema = z.object({
  email: z.string().email(),
  payRateType: z.nativeEnum(PayRateType),
  payRateInSubunits: z.number(),
  hoursPerWeek: z.number().nullable(),
  role: z.string(),
  startDate: z.string(),
});

function Create() {
  const company = useCurrentCompany();
  const router = useRouter();
  const [{ workers }] = trpc.contractors.list.useSuspenseQuery({ companyId: company.id, limit: 1 });
  const lastContractor = workers[0];
  const [templateId, setTemplateId] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      ...(lastContractor ? { payRateInSubunits: lastContractor.payRateInSubunits, role: lastContractor.role } : {}),
      payRateType: lastContractor?.payRateType ?? PayRateType.Hourly,
      hoursPerWeek: lastContractor?.hoursPerWeek ?? DEFAULT_WORKING_HOURS_PER_WEEK,
      startDate: formatISO(new Date(), { representation: "date" }),
    },
    resolver: zodResolver(schema),
  });

  const trpcUtils = trpc.useUtils();
  const saveMutation = trpc.contractors.create.useMutation({
    onSuccess: async (data) => {
      await trpcUtils.contractors.list.invalidate();
      await trpcUtils.documents.list.invalidate();
      router.push(
        data.documentId
          ? `/documents?${new URLSearchParams({ sign: data.documentId.toString(), next: "/people" })}`
          : "/people",
      );
    },
  });
  const submit = form.handleSubmit((values) => {
    saveMutation.mutate({
      companyId: company.id,
      ...values,
      // startDate only contains the date without a timezone. Appending T00:00:00 ensures the date is
      // parsed as midnight in the local timezone rather than UTC.
      startedAt: formatISO(new Date(`${values.startDate}T00:00:00`)),
      documentTemplateId: templateId ?? "",
    });
  });

  return (
    <MainLayout
      title="Who's joining?"
      headerActions={
        <Button variant="outline" asChild>
          <Link href="/people">Cancel</Link>
        </Button>
      }
    >
      <Form {...form}>
        <form onSubmit={(e) => void submit(e)} className="grid gap-4">
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
                <FormLabel>Start date</FormLabel>
                <FormControl>
                  <Input {...field} type="date" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormFields />

          <TemplateSelector
            selected={templateId}
            setSelected={setTemplateId}
            companyId={company.id}
            type={DocumentTemplateType.ConsultingContract}
          />
          <MutationStatusButton mutation={saveMutation} type="submit" className="justify-self-end">
            <PaperAirplaneIcon className="h-5 w-5" />
            Send invite
          </MutationStatusButton>
          <div>{saveMutation.isError ? <div className="text-red mb-4">{saveMutation.error.message}</div> : null}</div>
        </form>
      </Form>
    </MainLayout>
  );
}

export default Create;
