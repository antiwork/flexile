import Select from "@/components/Select";
import { DocumentTemplateType, trpc } from "@/trpc/client";
import React, { useEffect } from "react";

const TemplateSelector = ({
  selected,
  setSelected,
  companyId,
  type,
  ...props
}: {
  selected: string | null;
  setSelected: (templateId: string | null) => void;
  companyId: string | null;
  type: DocumentTemplateType;
}) => {
  const [templates] = trpc.documents.templates.list.useSuspenseQuery({ companyId, type, signable: true });
  const filteredTemplates = templates.filter(
    (template) => !template.generic || !templates.some((t) => !t.generic && t.type === template.type),
  );
  useEffect(() => {
    if (!filteredTemplates.some((t) => t.id === selected)) setSelected(filteredTemplates[0]?.id ?? null);
  }, [filteredTemplates]);
  return filteredTemplates.length > 1 ? (
    <Select
      label="Contract"
      value={selected}
      options={filteredTemplates.map((t) => ({ label: t.name, value: t.id }))}
      onChange={setSelected}
      {...props}
    />
  ) : null;
};

export default TemplateSelector;
