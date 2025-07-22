import React, { useEffect, useId } from "react";
import ComboBox from "@/components/ComboBox";
import { FormControl, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useCurrentCompany } from "@/global";
import { DocumentTemplateType, trpc } from "@/trpc/client";

const TemplateSelector = ({
  type,
  ...props
}: { type: DocumentTemplateType } & Omit<
  React.ComponentProps<typeof ComboBox> & { multiple?: false },
  "type" | "options"
>) => {
  const company = useCurrentCompany();
  const uid = useId();
  const [templates] = trpc.documents.templates.list.useSuspenseQuery({ companyId: company.id, type, signable: true });
  const filteredTemplates = templates.filter(
    (template) => !template.generic || !templates.some((t) => !t.generic && t.type === template.type),
  );
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
