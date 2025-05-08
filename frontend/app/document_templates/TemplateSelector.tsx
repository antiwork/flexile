import React, { useEffect, useId } from "react";
import ComboBox from "@/components/ComboBox";
import { Label } from "@/components/ui/label";
import { DocumentTemplateType, trpc } from "@/trpc/client";

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
  const uid = useId();
  const [templates] = trpc.documents.templates.list.useSuspenseQuery({ companyId, type, signable: true });
  const filteredTemplates = templates.filter(
    (template) => !template.generic || !templates.some((t) => !t.generic && t.type === template.type),
  );
  useEffect(() => {
    if (!filteredTemplates.some((t) => t.id === selected)) setSelected(filteredTemplates[0]?.id ?? null);
  }, [filteredTemplates]);
  return filteredTemplates.length > 1 ? (
    <>
      <Label htmlFor={`template-${uid}`}>Contract</Label>
      <ComboBox
        id={`template-${uid}`}
        value={selected ?? ""}
        options={filteredTemplates.map((t) => ({ label: t.name, value: t.id }))}
        onChange={setSelected}
        {...props}
      />
    </>
  ) : null;
};

export default TemplateSelector;
