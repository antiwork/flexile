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
      title={template.companyId !== null ? `${id ? "Edit" : "New"} ${template.name}` : `Default ${template.name}`}
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
          <Alert variant="destructive">
            <InformationCircleIcon />
            <AlertDescription>
              <div className="flex items-center justify-between gap-4">
                <p>This is our default template. Replace it with your own to fully customize it.</p>
                <MutationButton
                  size="small"
                  idleVariant="critical"
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
          withTitle={false}
          roles={Array.from(new Set(requiredFields.map((field) => field.role)))}
          fieldTypes={["text", "date", "checkbox"]}
          fields={fields}
          requiredFields={requiredFields}
          onSave={(data) => save(templateSchema.parse(data))}
          onLoad={(data) => setDocusealTemplate(templateSchema.parse(data))}
          preview={template.companyId === null}
          autosave
          customCss={`
            .mx-auto:has(> #main_container) {
              padding-left: 0px;
            }

            /* Fields list container */
            #fields_list_container {
              padding-right: 0px;
            }

            /* Apply default app font to all elements */
            * {
              font-family: "abc whyte", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
            }

            /* Override any direct inline styles */
            [style*="max-width: 95%"] {
              max-width: 100% !important;
            }

            .fields-list-item {
              border-radius: 0.5rem !important;
              padding: 4px 8px !important;
            }

            /* Add padding to roles dropdown trigger label */
            div[class*="roles-dropdown"] > label {
              padding-left: 12px !important;
              padding-right: 12px !important;
              border-radius: 0.5rem !important;
            }

            /* Apply border-radius to document images */
            #documents_container img,
            #pages_container img {
              border-radius: 0.5rem !important;
            }

            /* Remove dashed border from dropdown trigger span */
            .roles-dropdown label span.border-dashed,
            .roles-dropdown label span[class*="border-dashed"],
            .roles-dropdown label:hover span[class*="border-dashed"],
            div[class*="roles-dropdown"] label span.border-dashed,
            div[class*="roles-dropdown"] label span[class*="border-dashed"],
            div[class*="roles-dropdown"] label:hover span[class*="border-dashed"],
            label[class*="group/contenteditable"] span[class*="border-dashed"] {
              border-style: none !important;
              border: none !important;
            }

            /* Hide the container itself when it has this specific content */
            #documents_container:has(> div.sticky:only-child) {
              display: none !important;
            }

            /* Style dropdown menus to match app styling */
            .dropdown-content.menu {
              background-color: var(--popover, white) !important;
              color: var(--popover-foreground, black) !important;
              border-radius: 0.5rem !important; /* rounded-md */
              border: 1px solid var(--border, #e5e5e5) !important;
              box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1) !important; /* shadow-md */
              padding: 0.25rem !important; /* p-1 */
              overflow-x: hidden !important;
              overflow-y: auto !important;
              min-width: 8rem !important;
              max-height: calc(80vh) !important;
              margin-top: 4px !important; /* Add space between trigger and dropdown */
            }

            #document_dropzone {
              border-radius: 0.5rem !important;
              border-width: 1px !important;
              border-color: var(--color-gray-600, #6e6f6a) !important;
            }

            #field-types-grid {
              gap: 0.5rem !important;
            }

            #field-types-grid button {
              border-color: var(--color-gray-600, #6e6f6a) !important;
            }

            /* Style add document button to match app's button component */
            #add_document_button {
              display: inline-flex !important;
              align-items: center !important;
              justify-content: center !important;
              padding-left: 0.75rem !important; /* px-3 */
              padding-right: 0.75rem !important;
              padding-top: 0.5rem !important; /* py-2 */
              padding-bottom: 0.5rem !important;
              border-width: 1px !important;
              border-radius: 0.5rem !important; /* rounded-lg */
              gap: 0.375rem !important; /* gap-1.5 */
              cursor: pointer !important;
              background-color: transparent !important;
              color: inherit !important;
              border-color: var(--muted, var(--color-gray-300, #a3a3a0)) !important;
              box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05) !important; /* shadow-xs */
              white-space: nowrap !important;
            }

            /* Hover state */
            #add_document_button:hover {
              background-color: var(--accent, rgba(0, 0, 0, 0.05)) !important;
              color: var(--accent-foreground, var(--color-black, #1d1e17)) !important;
            }

            /* Style dropdown items */
            .dropdown-content.menu li > a {
              display: flex !important;
              align-items: center !important;
              padding: 0.375rem 0.5rem !important; /* py-1.5 px-2 */
              border-radius: 0.5rem !important; /* rounded-sm */
              cursor: pointer !important;
              outline: none !important;
              gap: 0.5rem !important;
              font-size: 16px !important;
            }

            .dropdown-content.menu li {
              gap: 0.75rem !important;
              margin-bottom: 2px !important;
            }

            .dropdown-content.menu li:last-child {
              margin-bottom: 0 !important;
            }

            /* Hover state for dropdown items */
            .dropdown-content.menu li > a:hover,
            .dropdown-content.menu li > a:focus,
            .dropdown-content.menu li > a.active {
              background-color: var(--accent, #f3f4f6) !important;
              color: var(--accent-foreground, black) !important;
            }
          `}
        />
      </div>
    </MainLayout>
  );
}
