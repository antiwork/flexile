"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import TemplateSelector from "@/app/document_templates/TemplateSelector";
import MainLayout from "@/app/components/main-layout";
import { MutationStatusButton } from "@/components/MutationButton";
import { Input } from "@/components/ui/input";
import { DocumentTemplateType, PayRateType } from "@/db/enums";
import { trpc } from "@/trpc/client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import FormFields from "@/app/people/FormFields";
import { DEFAULT_WORKING_HOURS_PER_WEEK } from "@/models";
import { formatISO } from "date-fns";

const schema = z.object({
  email: z.string().email(),
  companyName: z.string().min(1, "This field is required"),
  role: z.string().min(1, "This field is required"),
  payRateType: z.nativeEnum(PayRateType),
  payRateInSubunits: z.number().min(1),
  hoursPerWeek: z.number().min(1),
  startDate: z.string().min(1, "This field is required"),
});
export default function CreateCompanyInvitation() {
  const router = useRouter();
  const trpcUtils = trpc.useUtils();
  const queryClient = useQueryClient();

  const form = useForm({
    defaultValues: {
      payRateType: PayRateType.Hourly,
      hoursPerWeek: DEFAULT_WORKING_HOURS_PER_WEEK,
      startDate: formatISO(new Date(), { representation: "date" }),
    },
    resolver: zodResolver(schema),
  });
  const [templateId, setTemplateId] = useState<string | null>(null);

  const inviteCompany = trpc.companies.invite.useMutation({
    onSuccess: async (data) => {
      await queryClient.refetchQueries({ queryKey: ["currentUser"] });
      await trpcUtils.documents.list.invalidate();
      await trpcUtils.companies.list.invalidate({ invited: true });
      router.push(
        `/documents?${new URLSearchParams({ sign: data.documentId.toString(), next: "/company_invitations" })}`,
      );
    },
    onError: (error) => {
      const errors = z.object({ errors: z.record(z.string(), z.string()) }).parse(JSON.parse(error.message)).errors;
      form.setError("root", { message: Object.values(errors)[0] ?? "" });
    },
  });

  const submit = form.handleSubmit((values) =>
    inviteCompany.mutate({
      templateId: templateId ?? "",
      ...values,
      rate: values.payRateInSubunits,
      rateType: values.payRateType,
    }),
  );

  return (
    <MainLayout title="Who are you billing?">
      <Form {...form}>
        <form className="space-y-6" onSubmit={(e) => void submit(e)}>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input {...field} type="email" placeholder="CEO's email" />
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

          <FormField
            control={form.control}
            name="companyName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Company name</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Company's legal name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <TemplateSelector
            selected={templateId}
            setSelected={setTemplateId}
            companyId={null}
            type={DocumentTemplateType.ConsultingContract}
          />

          <FormFields />

          <MutationStatusButton type="submit" mutation={inviteCompany} className="justify-self-end">
            Send invite
          </MutationStatusButton>

          {form.formState.errors.root ? (
            <div className="text-red text-center text-xs">
              {form.formState.errors.root.message ?? "An error occurred"}
            </div>
          ) : null}
        </form>
      </Form>
    </MainLayout>
  );
}
