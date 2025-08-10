import { useQuery } from "@tanstack/react-query";
import React, { useEffect, useId } from "react";
import { z } from "zod";
import ComboBox from "@/components/ComboBox";
import { FormControl, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { DocumentTemplateType } from "@/db/enums";
import { useCurrentCompany } from "@/global";
import { type Document, documentSchema } from "@/models/document";
import { request } from "@/utils/request";
import { company_documents_path } from "@/utils/routes";

const TemplateSelector = ({
  type,
  ...props
}: { type: DocumentTemplateType } & Omit<
  React.ComponentProps<typeof ComboBox> & { multiple?: false },
  "type" | "options"
>) => {
  const company = useCurrentCompany();
  const uid = useId();

  const { data: templates = [] } = useQuery<Document[]>({
    queryKey: ["companyDocuments", company.id, { type, signable: true }],
    queryFn: async () => {
      const params = new URLSearchParams({ type: String(type), signable: "true" });
      const url = `${company_documents_path(company.id)}?${params.toString()}`;
      const response = await request({ method: "GET", accept: "json", url, assertOk: true });
      return z.array(documentSchema).parse(await response.json());
    },
  });

  const filteredTemplates = templates.filter((t) => t.signatories.every((s) => s.signedAt === null));

  useEffect(() => {
    if (!filteredTemplates.some((t) => t.id === props.value)) props.onChange(filteredTemplates[0]?.id ?? "");
  }, [filteredTemplates]);
  return filteredTemplates.length > 1 ? (
    <FormItem>
      <FormLabel>Contract</FormLabel>
      <FormControl>
        <ComboBox
          id={`template-${uid}`}
          {...props}
          options={filteredTemplates.map((t) => ({ label: t.name, value: t.id }))}
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  ) : null;
};

export default TemplateSelector;
