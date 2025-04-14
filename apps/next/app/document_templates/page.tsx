"use client";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { FilePlusIcon, FileTextIcon, PercentIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import Modal from "@/components/Modal";
import MutationButton from "@/components/MutationButton";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DocumentTemplateType } from "@/db/enums";
import { useCurrentCompany, useCurrentUser } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { formatDate } from "@/utils/time";
import DocumentsLayout from "../documents/Layout";

type Template = RouterOutput["documents"]["templates"]["list"][number];
const typeLabels = {
  [DocumentTemplateType.ConsultingContract]: "Agreement",
  [DocumentTemplateType.EquityPlanContract]: "Equity plan",
};

const columnHelper = createColumnHelper<Template>();
const columns = [
  columnHelper.accessor("name", {
    header: "Template",
    cell: (info) => (
      <Link href={`/document_templates/${info.row.original.id}`} className="after:absolute after:inset-0">
        {info.getValue()}
      </Link>
    ),
  }),
  columnHelper.simple("type", "Type", (value) => typeLabels[value]),
  columnHelper.simple("updatedAt", "Last updated", formatDate),
];

export default function TemplatesPage() {
  const user = useCurrentUser();
  const router = useRouter();
  const company = useCurrentCompany();
  const [templates, { refetch }] = trpc.documents.templates.list.useSuspenseQuery({ companyId: company.id });
  const filteredTemplates = useMemo(
    () =>
      company.id && templates.length > 1
        ? templates.filter(
            (template) => !template.generic || !templates.some((t) => !t.generic && t.type === template.type),
          )
        : templates,
    [templates],
  );
  const table = useTable({ columns, data: filteredTemplates });
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const create = trpc.documents.templates.create.useMutation({
    onSuccess: (id) => {
      void refetch();
      router.push(`/document_templates/${id}`);
    },
  });

  return (
    <DocumentsLayout
      headerActions={
        user.activeRole === "administrator" || user.activeRole === "lawyer" ? (
          <>
            <Button onClick={() => setShowTemplateModal(true)}>
              <FilePlusIcon className="size-4" />
              New template
            </Button>

            <Modal title="Select template type" open={showTemplateModal} onClose={() => setShowTemplateModal(false)}>
              <div className="grid gap-4">
                <Alert>
                  <InformationCircleIcon />
                  <AlertDescription>
                    By creating a custom document template, you acknowledge that Flexile shall not be liable for any
                    claims, liabilities, or damages arising from or related to such documents. See our{" "}
                    <Link href="/terms" className="text-blue-600 hover:underline">
                      Terms of Service
                    </Link>{" "}
                    for more details.
                  </AlertDescription>
                </Alert>
                <div className="grid grid-cols-2 gap-4">
                  <MutationButton
                    idleVariant="outline"
                    className="h-auto rounded-md p-6"
                    mutation={create}
                    param={{
                      companyId: company.id,
                      name: "Consulting agreement",
                      type: DocumentTemplateType.ConsultingContract,
                    }}
                  >
                    <div className="flex flex-col items-center">
                      <FileTextIcon className="size-6" />
                      <span className="mt-2">Consulting agreement</span>
                    </div>
                  </MutationButton>
                  <MutationButton
                    idleVariant="outline"
                    className="h-auto rounded-md p-6"
                    mutation={create}
                    param={{
                      companyId: company.id,
                      name: "Equity grant contract",
                      type: DocumentTemplateType.EquityPlanContract,
                    }}
                  >
                    <div className="flex flex-col items-center">
                      <PercentIcon className="size-6" />
                      <span className="mt-2">Equity grant contract</span>
                    </div>
                  </MutationButton>
                </div>
              </div>
            </Modal>
          </>
        ) : null
      }
    >
      <div className="overflow-x-auto">
        <Table table={table} hoverable />
      </div>
    </DocumentsLayout>
  );
}
