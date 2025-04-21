"use client";
import { DocusealBuilder } from "@docuseal/react";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import MainLayout from "@/components/layouts/Main";
import MutationButton from "@/components/MutationButton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useCurrentCompany } from "@/global";
import { DocumentTemplateType, trpc } from "@/trpc/client";

const templateSchema = z.object({
  name: z.string(),
  documents: z.array(z.unknown()),
  fields: z.array(z.object({ name: z.string() })),
});
type Template = z.infer<typeof templateSchema>;

export default function EditTemplatePage() {
  const { id } = useParams<{ id: string }>();

  const router = useRouter();
  const company = useCurrentCompany();
  const [{ template, token, requiredFields }] = trpc.documents.templates.get.useSuspenseQuery({
    id,
    companyId: company.id,
  });
  const update = trpc.documents.templates.update.useMutation();

  const [docusealTemplate, setDocusealTemplate] = useState<Template | null>(null);
  const isSignable = (template: Template) =>
    requiredFields.every((field) => template.fields.some((f) => f.name === field.name));

  const save = (data: Template) => {
    setDocusealTemplate(data);
    if (template.companyId === null) return;
    return void update.mutateAsync({
      companyId: company.id,
      id,
      name: data.name,
      signable: isSignable(data),
    });
  };

  const fields =
    template.type === DocumentTemplateType.BoardConsent
      ? []
      : [
          {
            name: "__companyName",
            type: "text",
            title: "Company name (auto-filled)",
            role: "Company Representative",
          },
          {
            name: "__companyEmail",
            type: "text",
            title: "Company representative email (auto-filled)",
            role: "Company Representative",
          },
          {
            name: "__companyRepresentativeName",
            type: "text",
            title: "Company representative name (auto-filled)",
            role: "Company Representative",
          },
          { name: "__signerName", type: "text", title: "Signer name (auto-filled)", role: "Signer" },
          { name: "__signerLegalEntity", type: "text", title: "Signer legal entity (auto-filled)", role: "Signer" },
          { name: "__signerEmail", type: "text", title: "Signer email (auto-filled)", role: "Signer" },
          { name: "__signerAddress", type: "text", title: "Signer address (auto-filled)", role: "Signer" },
          { name: "__signerCountry", type: "text", title: "Signer country (auto-filled)", role: "Signer" },
        ];
  switch (template.type) {
    case DocumentTemplateType.ConsultingContract:
      fields.push(
        {
          name: "__companyCountry",
          type: "text",
          title: "Company country (auto-filled)",
          role: "Company Representative",
        },
        {
          name: "__companyAddress",
          type: "text",
          title: "Company address (auto-filled)",
          role: "Company Representative",
        },
        { name: "__role", type: "text", title: "Consultant role (auto-filled)", role: "Company Representative" },
        { name: "__payRate", type: "text", title: "Pay rate (auto-filled)", role: "Company Representative" },
        { name: "__startDate", type: "date", title: "Start date (auto-filled)", role: "Company Representative" },
      );
      break;
    case DocumentTemplateType.BoardConsent:
      fields.push(
        {
          name: "__companyName",
          type: "text",
          title: "Company name (auto-filled)",
          role: "Board member",
        },
        {
          name: "__boardApprovalDate",
          type: "date",
          title: "Board approval date (auto-filled)",
          role: "Board member",
        },
        { name: "__grantType", type: "text", title: "Grant type (auto-filled)", role: "Board member" },
        {
          name: "__quantity",
          type: "number",
          title: "Number of options (auto-filled)",
          role: "Board member",
        },
        {
          name: "__exercisePrice",
          type: "number",
          title: "Exercise price per share (auto-filled)",
          role: "Board member",
        },
        {
          name: "__optionholderName",
          type: "text",
          title: "Optionholder name (auto-filled)",
          role: "Board member",
        },
        {
          name: "__optionholderAddress",
          type: "text",
          title: "Optionholder address (auto-filled)",
          role: "Board member",
        },
        {
          name: "__vestingCommencementDate",
          type: "date",
          title: "Vesting commencement date (auto-filled)",
          role: "Board member",
        },
        {
          name: "__vestingSchedule",
          type: "text",
          title: "Vesting schedule (auto-filled)",
          role: "Board member",
        },
      );
      break;
    case DocumentTemplateType.EquityPlanContract:
      fields.push(
        { name: "__name", type: "text", title: "Optionholder name (auto-filled)", role: "Company Representative" },
        {
          name: "__boardApprovalDate",
          type: "date",
          title: "Board approval date (auto-filled)",
          role: "Company Representative",
        },
        {
          name: "__quantity",
          type: "number",
          title: "Number of options (auto-filled)",
          role: "Company Representative",
        },
        {
          name: "__vestingCommencementDate",
          type: "date",
          title: "Vesting commencement date (auto-filled)",
          role: "Company Representative",
        },
        { name: "__grantType", type: "text", title: "Grant type (auto-filled)", role: "Company Representative" },
        {
          name: "__exercisePrice",
          type: "number",
          title: "Exercise price per share (auto-filled)",
          role: "Company Representative",
        },
        {
          name: "__exerciseSchedule",
          type: "text",
          title: "Exercise schedule (auto-filled)",
          role: "Company Representative",
        },
        {
          name: "__totalExercisePrice",
          type: "number",
          title: "Total exercise price (auto-filled)",
          role: "Company Representative",
        },
        {
          name: "__expirationDate",
          type: "date",
          title: "Expiration date (auto-filled)",
          role: "Company Representative",
        },
        {
          name: "__vestingSchedule",
          type: "text",
          title: "Vesting schedule (auto-filled)",
          role: "Company Representative",
        },
      );
      break;
  }
  return (
    <MainLayout
      title={
        template.companyId !== null
          ? id
            ? "Edit document template"
            : "New document template"
          : "Default document template"
      }
      headerActions={
        <Button variant="outline" asChild>
          <Link href="/documents">
            <ArrowLeftIcon className="size-4" />
            Back to documents
          </Link>
        </Button>
      }
    >
      <div className="grid gap-6">
        {template.companyId === null ? (
          <Alert>
            <InformationCircleIcon />
            <AlertDescription>
              <div className="flex items-center justify-between gap-4">
                <p>This is our default template. Replace it with your own to fully customize it.</p>
                <MutationButton
                  mutation={trpc.documents.templates.create.useMutation({
                    onSuccess: (id) => {
                      router.push(`/document_templates/${id}`);
                    },
                  })}
                  param={{
                    companyId: company.id,
                    name: template.name,
                    type: template.type,
                  }}
                >
                  Replace default template
                </MutationButton>
              </div>
            </AlertDescription>
          </Alert>
        ) : docusealTemplate?.documents.length && !isSignable(docusealTemplate) ? (
          <Alert>
            <InformationCircleIcon />
            <AlertDescription>
              To use this template, add at least the signature fields for both parties below.
            </AlertDescription>
          </Alert>
        ) : null}
        <DocusealBuilder
          token={token}
          withSendButton={false}
          withSignYourselfButton={false}
          roles={Array.from(new Set(requiredFields.map((field) => field.role)))}
          fieldTypes={["text", "date", "checkbox"]}
          fields={fields}
          requiredFields={requiredFields}
          onSave={(data) => save(templateSchema.parse(data))}
          onLoad={(data) => setDocusealTemplate(templateSchema.parse(data))}
          preview={template.companyId === null}
          autosave
        />
      </div>
    </MainLayout>
  );
}
