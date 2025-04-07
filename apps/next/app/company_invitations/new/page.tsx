"use client";

import { useQueryClient } from "@tanstack/react-query";
import { formatISO } from "date-fns";
import { useRouter } from "next/navigation";
import { z } from "zod";
import TemplateSelector from "@/app/document_templates/TemplateSelector";
import { CardRow } from "@/components/Card";
import DecimalInput from "@/components/DecimalInput";
import FormSection from "@/components/FormSection";
import Input from "@/components/Input";
import MainLayout from "@/components/layouts/Main";
import MutationButton from "@/components/MutationButton";
import NumberInput from "@/components/NumberInput";
import RadioButtons from "@/components/RadioButtons";
import { DocumentTemplateType, PayRateType } from "@/db/enums";
import { trpc } from "@/trpc/client";
import { useState } from "react";

export default function CreateCompanyInvitation() {
  const router = useRouter();
  const trpcUtils = trpc.useUtils();
  const queryClient = useQueryClient();

  const [companyAdministratorEmail, setCompanyAdministratorEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [roleName, setRoleName] = useState("");
  const [rolePayRateType, setRolePayRateType] = useState<"hourly" | "project_based">("hourly");
  const [roleRate, setRoleRate] = useState<number | null>(null);
  const [roleHours, setRoleHours] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const startDate = formatISO(new Date(), { representation: "date" });
  const [templateId, setTemplateId] = useState<string | null>(null);

  const isValid =
    companyName.length > 0 &&
    companyAdministratorEmail.length > 0 &&
    roleName.length > 0 &&
    roleRate &&
    roleRate > 0 &&
    roleHours &&
    roleHours > 0;

  const inviteCompany = trpc.companies.invite.useMutation({
    onSuccess: async (data) => {
      await queryClient.refetchQueries({ queryKey: ["currentUser"] });
      await trpcUtils.documents.list.invalidate();
      await trpcUtils.companies.list.invalidate({ invited: true });
      router.push(
        `/documents?${new URLSearchParams({ sign: data.documentId.toString(), next: "/company_invitations" })}`,
      );
    },
    onError: (error) =>
      setErrors(z.object({ errors: z.record(z.string(), z.string()) }).parse(JSON.parse(error.message)).errors),
  });

  return (
    <MainLayout title="Who are you billing?">
      <div className="space-y-6">
        <FormSection title="Company details">
          <CardRow className="grid gap-4">
            <Input
              value={companyAdministratorEmail}
              onChange={setCompanyAdministratorEmail}
              label="Email"
              placeholder="CEO's email"
              type="email"
              invalid={!!errors["user.email"]}
              help={errors["user.email"]}
            />
            <Input
              value={companyName}
              onChange={setCompanyName}
              label="Company name"
              placeholder="Company's legal name"
            />
            <TemplateSelector
              selected={templateId}
              setSelected={setTemplateId}
              companyId={null}
              type={DocumentTemplateType.ConsultingContract}
            />
          </CardRow>
        </FormSection>

        <FormSection title="Role details">
          <CardRow className="grid gap-4">
            <Input
              value={roleName}
              onChange={setRoleName}
              label="Role name"
              invalid={!!errors["company_role.name"]}
              help={errors["company_role.name"]}
            />
            <RadioButtons
              value={rolePayRateType}
              onChange={setRolePayRateType}
              options={[
                { label: "Hourly", value: "hourly" },
                { label: "Project-based", value: "project_based" },
              ]}
              label="Contract type"
              invalid={!!errors["company_role.rate.pay_rate_type"]}
              help={errors["company_role.rate.pay_rate_type"]}
            />
            <DecimalInput
              value={roleRate}
              onChange={setRoleRate}
              label="Rate"
              prefix="$"
              suffix={rolePayRateType === "hourly" ? "/ hour" : "/ project"}
              invalid={!!errors["company_role.rate.pay_rate_in_subunits"]}
              help={errors["company_role.rate.pay_rate_in_subunits"]}
            />
            {rolePayRateType === "hourly" && (
              <NumberInput
                value={roleHours}
                onChange={setRoleHours}
                label="Average hours"
                suffix="/ week"
                invalid={!!errors["company_worker.hours_per_week"]}
                help={errors["company_worker.hours_per_week"]}
              />
            )}
          </CardRow>
        </FormSection>

        <div className="grid gap-x-5 gap-y-3 md:grid-cols-[25%_1fr]">
          <div />
          <div>
            <MutationButton
              mutation={inviteCompany}
              disabled={!isValid}
              param={{
                templateId: templateId ?? "",
                email: companyAdministratorEmail,
                companyName,
                roleName,
                rate: (roleRate ?? 0) * 100,
                rateType: rolePayRateType === "hourly" ? PayRateType.Hourly : PayRateType.ProjectBased,
                hoursPerWeek: roleHours,
                startDate,
              }}
            >
              Send invite
            </MutationButton>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
