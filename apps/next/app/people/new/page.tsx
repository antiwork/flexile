"use client";
import { PaperAirplaneIcon } from "@heroicons/react/16/solid";
import { formatISO } from "date-fns";
import { DatePicker } from "../../../components/ui/date-picker";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { parseAsInteger, useQueryState } from "nuqs";
import React, { useEffect, useState } from "react";
import TemplateSelector from "@/app/document_templates/TemplateSelector";
import RoleSelector from "@/app/roles/Selector";
import Button from "@/components/Button";
import { CardRow } from "@/components/Card";
import Checkbox from "@/components/Checkbox";
import DecimalInput from "@/components/DecimalInput";
import FormSection from "@/components/FormSection";
import Input from "@/components/Input";
import MainLayout from "@/components/layouts/Main";
import MutationButton from "@/components/MutationButton";
import NumberInput from "@/components/NumberInput";
import { useCurrentCompany } from "@/global";
import { DEFAULT_WORKING_HOURS_PER_WEEK } from "@/models";
import { AVG_TRIAL_HOURS } from "@/models/constants";
import { DocumentTemplateType, PayRateType, trpc } from "@/trpc/client";
import { useOnChange } from "@/utils/useOnChange";

function Create() {
  const company = useCurrentCompany();
  const router = useRouter();
  const [applicationId] = useQueryState("application_id", parseAsInteger);
  const [{ workers }] = trpc.contractors.list.useSuspenseQuery({
    companyId: company.id,
    order: "desc",
    page: 1,
    perPage: 1,
  });
  const lastContractor = workers[0];
  const { data: application } = trpc.roles.applications.get.useQuery(
    { companyId: company.id, id: BigInt(applicationId ?? 0) },
    { enabled: !!applicationId },
  );
  const [roles] = trpc.roles.list.useSuspenseQuery({ companyId: company.id });
  const [templateId, setTemplateId] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState(roles[0]?.id);
  const role = roles.find((r) => r.id === roleId);
  useEffect(() => {
    if (!role) setRoleId(roles[0]?.id);
  }, [roles, roleId]);
  const [rateUsd, setRateUsd] = useState(50);
  const [hours, setHours] = useState(0);
  const [skipTrial, setSkipTrial] = useState(false);
  const [startDate, setStartDate] = useState(formatISO(new Date(), { representation: "date" }));
  const defaultHours = role?.trialEnabled ? AVG_TRIAL_HOURS : (application?.hoursPerWeek ?? 0);
  useEffect(() => {
    setEmail(application?.email ?? "");
    setRoleId(application?.role.id ?? lastContractor?.role.id);
    setHours(defaultHours);
  }, [application]);
  const onTrial = (role?.trialEnabled && !skipTrial && role.payRateType !== PayRateType.Salary) ?? false;

  useOnChange(() => {
    if (role) {
      setRateUsd((onTrial ? role.trialPayRateInSubunits : role.payRateInSubunits) / 100);
      setHours(defaultHours);
    }
  }, [role, onTrial]);

  const valid =
    templateId &&
    email &&
    ((role?.payRateType === PayRateType.Hourly && hours) ||
      role?.payRateType === PayRateType.ProjectBased ||
      role?.payRateType === PayRateType.Salary) &&
    startDate.length > 0;

  const trpcUtils = trpc.useUtils();
  const saveMutation = trpc.contractors.create.useMutation({
    onSuccess: async (data) => {
      await trpcUtils.documents.list.invalidate();
      router.push(
        data.documentId
          ? `/documents?${new URLSearchParams({ sign: data.documentId.toString(), next: "/people?type=onboarding" })}`
          : `/people?type=onboarding`,
      );
    },
  });

  return (
    <MainLayout
      title="Who's joining?"
      headerActions={
        <Button variant="outline" asChild>
          <Link href="/people">Cancel</Link>
        </Button>
      }
    >
      <FormSection title="Details">
        <CardRow className="grid gap-4">
          <Input value={email} onChange={setEmail} type="email" label="Email" placeholder="Contractor's email" />
          <DatePicker 
            date={startDate ? new Date(`${startDate}T00:00:00`) : undefined} 
            setDate={(date) => date ? setStartDate(formatISO(date, { representation: "date" })) : setStartDate("")} 
            label="Start date" 
          />
          <RoleSelector value={roleId ?? null} onChange={setRoleId} />
          {role?.trialEnabled && role.payRateType !== PayRateType.Salary ? (
            <Checkbox checked={skipTrial} onChange={setSkipTrial} label="Skip trial period" />
          ) : null}
          <DecimalInput
            value={rateUsd}
            onChange={(value) => setRateUsd(value ?? 0)}
            label="Rate"
            prefix="$"
            suffix={
              role?.payRateType === PayRateType.ProjectBased
                ? "/ project"
                : role?.payRateType === PayRateType.Salary
                  ? "/ year"
                  : "/ hour"
            }
          />
          {role?.payRateType === PayRateType.Hourly && (
            <NumberInput
              value={hours}
              onChange={(value) => setHours(value ?? 0)}
              label="Average hours"
              placeholder={DEFAULT_WORKING_HOURS_PER_WEEK.toString()}
              suffix="/ week"
            />
          )}
        </CardRow>
        <TemplateSelector
          selected={templateId}
          setSelected={setTemplateId}
          companyId={company.id}
          type={DocumentTemplateType.ConsultingContract}
        />
      </FormSection>
      <div className="grid gap-x-5 gap-y-3 md:grid-cols-[25%_1fr]">
        <div />
        <div>
          <MutationButton
            mutation={saveMutation}
            disabled={!valid}
            param={{
              companyId: company.id,
              applicationId,
              email,
              // startDate only contains the date without a timezone. Appending T00:00:00 ensures the date is
              // parsed as midnight in the local timezone rather than UTC.
              startedAt: formatISO(new Date(`${startDate}T00:00:00`)),
              payRateInSubunits: rateUsd * 100,
              payRateType: role?.payRateType ?? PayRateType.Hourly,
              onTrial,
              roleId: role?.id ?? null,
              hoursPerWeek: hours,
              documentTemplateId: templateId ?? "",
            }}
          >
            <PaperAirplaneIcon className="h-5 w-5" />
            Send invite
          </MutationButton>
        </div>
        <div>{saveMutation.isError ? <div className="text-red mb-4">{saveMutation.error.message}</div> : null}</div>
      </div>
    </MainLayout>
  );
}

export default Create;
