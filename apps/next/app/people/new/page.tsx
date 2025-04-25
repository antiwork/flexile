"use client";
import { PaperAirplaneIcon } from "@heroicons/react/16/solid";
import { formatISO } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { parseAsInteger, useQueryState } from "nuqs";
import React, { useState } from "react";
import TemplateSelector from "@/app/document_templates/TemplateSelector";
import RoleSelector from "@/app/roles/Selector";
import FormSection from "@/components/FormSection";
import Input from "@/components/Input";
import MainLayout from "@/components/layouts/Main";
import MutationButton from "@/components/MutationButton";
import NumberInput from "@/components/NumberInput";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useCurrentCompany } from "@/global";
import { DEFAULT_WORKING_HOURS_PER_WEEK } from "@/models";
import { DocumentTemplateType, PayRateType, trpc } from "@/trpc/client";

function Create() {
  const company = useCurrentCompany();
  const router = useRouter();
  const [applicationId] = useQueryState("application_id", parseAsInteger);
  
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState<string | null>(null);
  const [rateUsd, setRateUsd] = useState(50);
  const [hours, setHours] = useState(DEFAULT_WORKING_HOURS_PER_WEEK);
  const [startDate, setStartDate] = useState(formatISO(new Date(), { representation: "date" }));
  
  const payRateType = PayRateType.Hourly;
  const onTrial = false;

  const valid =
    templateId &&
    email &&
    hours > 0 &&
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
        <CardContent>
          <div className="grid gap-4">
            <Input value={email} onChange={setEmail} type="email" label="Email" placeholder="Contractor's email" />
            <Input value={startDate} onChange={setStartDate} type="date" label="Start date" />
            <RoleSelector value={roleId} onChange={setRoleId} />
            <div className="grid gap-2">
              <Label htmlFor="rate">Rate</Label>
              <NumberInput
                id="rate"
                value={rateUsd}
                onChange={(value) => setRateUsd(value ?? 0)}
                prefix="$"
                suffix="/ hour"
                decimal
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="hours">Average hours</Label>
              <NumberInput
                id="hours"
                value={hours}
                onChange={(value) => setHours(value ?? 0)}
                placeholder={DEFAULT_WORKING_HOURS_PER_WEEK.toString()}
                suffix="/ week"
              />
            </div>
          </div>

          <TemplateSelector
            selected={templateId}
            setSelected={setTemplateId}
            companyId={company.id}
            type={DocumentTemplateType.ConsultingContract}
          />
        </CardContent>
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
              payRateType,
              onTrial,
              roleId,
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
