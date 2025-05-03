"use client";

import { useQueryClient } from "@tanstack/react-query";
import { formatISO } from "date-fns";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import TemplateSelector from "@/app/document_templates/TemplateSelector";
import FormSection from "@/components/FormSection";
import MainLayout from "@/components/layouts/Main";
import MutationButton from "@/components/MutationButton";
import NumberInput from "@/components/NumberInput";
import RadioButtons from "@/components/RadioButtons";
import { CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DocumentTemplateType, PayRateType } from "@/db/enums";
import { trpc } from "@/trpc/client";

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
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="admin-email">Email</Label>
              <Input
                id="admin-email"
                type="email"
                value={companyAdministratorEmail}
                onChange={(e) => setCompanyAdministratorEmail(e.target.value)}
                placeholder="CEO's email"
                aria-invalid={!!errors["user.email"]}
              />
              {errors["user.email"] ? <span className="text-destructive text-sm">{errors["user.email"]}</span> : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="company-name">Company name</Label>
              <Input
                id="company-name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Company's legal name"
              />
            </div>

            <TemplateSelector
              selected={templateId}
              setSelected={setTemplateId}
              companyId={null}
              type={DocumentTemplateType.ConsultingContract}
            />
          </CardContent>
        </FormSection>

        <FormSection title="Role details">
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="role-name">Role name</Label>
              <Input
                id="role-name"
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                aria-invalid={!!errors["company_role.name"]}
              />
              {errors["company_role.name"] ? (
                <span className="text-destructive text-sm">{errors["company_role.name"]}</span>
              ) : null}
            </div>

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

            <div className="grid gap-2">
              <Label htmlFor="role-rate">Rate</Label>
              <NumberInput
                id="role-rate"
                value={roleRate}
                onChange={(value) => setRoleRate(value ?? null)}
                prefix="$"
                suffix={rolePayRateType === "hourly" ? "/ hour" : "/ project"}
                invalid={!!errors["company_role.rate.pay_rate_in_subunits"]}
                decimal
              />
              {errors["company_role.rate.pay_rate_in_subunits"] ? (
                <span className="text-destructive text-sm">{errors["company_role.rate.pay_rate_in_subunits"]}</span>
              ) : null}
            </div>

            {rolePayRateType === "hourly" && (
              <div className="grid gap-2">
                <Label htmlFor="role-hours">Average hours</Label>
                <NumberInput
                  id="role-hours"
                  value={roleHours}
                  onChange={(value) => setRoleHours(value ?? null)}
                  suffix="/ week"
                  invalid={!!errors["company_worker.hours_per_week"]}
                />
                {errors["company_worker.hours_per_week"] ? (
                  <span className="text-destructive text-sm">{errors["company_worker.hours_per_week"]}</span>
                ) : null}
              </div>
            )}
          </CardContent>
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
