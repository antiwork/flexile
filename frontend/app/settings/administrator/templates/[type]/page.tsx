"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { templateTypeNames, templateTypes, useDocumentTemplateQuery } from "@/app/(dashboard)/documents";
import { MutationStatusButton } from "@/components/MutationButton";
import { Editor as RichTextEditor } from "@/components/RichText";
import { Form, FormField } from "@/components/ui/form";
import { useCurrentCompany } from "@/global";
import { request } from "@/utils/request";
import { company_template_path } from "@/utils/routes";

const formSchema = z.object({ text: z.string().nullable() });

export default function Details() {
  const router = useRouter();
  const { type: urlType } = useParams<{ type: string }>();
  const company = useCurrentCompany();
  const type = z.enum(templateTypes).parse(urlType);
  const queryClient = useQueryClient();

  const { name } = templateTypeNames[type];
  const { data: template, refetch } = useSuspenseQuery(useDocumentTemplateQuery(type));
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { text: template.text },
  });
  const submitMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      await request({
        method: "PUT",
        url: company_template_path(company.id, type),
        jsonData: values,
        accept: "json",
      });
      await queryClient.invalidateQueries({ queryKey: ["templates", company.id] });
      await refetch();
      router.push(`/settings/administrator/templates`);
    },
  });
  const submit = form.handleSubmit((values) => submitMutation.mutate(values));

  return (
    <form className="space-y-4" onSubmit={(e) => void submit(e)}>
      <Form {...form}>
        <h2 className="text-2xl font-bold">{name}</h2>
        <FormField control={form.control} name="text" render={({ field }) => <RichTextEditor {...field} />} />
        <MutationStatusButton
          type="submit"
          mutation={submitMutation}
          loadingText="Saving..."
          successText="Changes saved"
        >
          Save changes
        </MutationStatusButton>
      </Form>
    </form>
  );
}
