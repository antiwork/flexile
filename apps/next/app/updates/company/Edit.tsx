"use client";
import { utc } from "@date-fns/utc";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/16/solid";
import { EnvelopeIcon, UsersIcon } from "@heroicons/react/24/outline";
import { useMutation } from "@tanstack/react-query";
import { startOfMonth, startOfQuarter, startOfYear, subMonths, subQuarters, subYears } from "date-fns";
import { useParams, useRouter } from "next/navigation";
import React, { useState } from "react";
import Checkbox from "@/components/Checkbox";
import Input from "@/components/Input";
import MainLayout from "@/components/layouts/Main";
import Modal from "@/components/Modal";
import MutationButton from "@/components/MutationButton";
import { Editor as RichTextEditor } from "@/components/RichText";
import Select from "@/components/Select";
import { Button } from "@/components/ui/button";
import { useCurrentCompany } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { assertDefined } from "@/utils/assert";
import { pluralize } from "@/utils/pluralize";
import { formatServerDate } from "@/utils/time";
import FinancialOverview, { formatPeriod } from "./FinancialOverview";

type CompanyUpdate = RouterOutput["companyUpdates"]["get"];
const Edit = ({ update }: { update?: CompanyUpdate }) => {
  const { id } = useParams<{ id?: string }>();
  const company = useCurrentCompany();
  const router = useRouter();
  const year = new Date().getFullYear();
  const trpcUtils = trpc.useUtils();
  const [financialReports] = trpc.financialReports.get.useSuspenseQuery({
    years: [year, year - 1, year - 2],
    companyId: company.id,
  });

  const first = startOfMonth(new Date(), { in: utc });
  const lastMonth = formatServerDate(startOfMonth(subMonths(first, 1)));
  const lastQuarter = formatServerDate(startOfQuarter(subQuarters(first, 1)));
  const lastYear = formatServerDate(startOfYear(subYears(first, 1)));

  const periodOptions = [
    { label: "None", value: "", period: null, periodStartedOn: null },
    {
      label: `${formatPeriod("month", lastMonth)} (Last month)`,
      value: "month",
      period: "month",
      periodStartedOn: lastMonth,
    },
    {
      label: `${formatPeriod("quarter", lastQuarter)} (Last quarter)`,
      value: "quarter",
      period: "quarter",
      periodStartedOn: lastQuarter,
    },
    {
      label: `${formatPeriod("year", lastYear)} (Last year)`,
      value: "year",
      period: "year",
      periodStartedOn: lastYear,
    },
  ] satisfies (Pick<CompanyUpdate, "period" | "periodStartedOn"> & { label: string; value: string })[];
  if (
    update?.period &&
    update.periodStartedOn &&
    !periodOptions.some((o) => o.period === update.period && o.periodStartedOn === update.periodStartedOn)
  ) {
    periodOptions.push({
      label: formatPeriod(update.period, update.periodStartedOn),
      value: "existing",
      period: update.period,
      periodStartedOn: update.periodStartedOn,
    });
  }

  const [title, setTitle] = useState(update?.title ?? "");
  const [body, setBody] = useState(update?.body ?? "");
  const [videoUrl, setVideoUrl] = useState<string | null>(update?.videoUrl ?? null);
  const [showRevenue, setShowRevenue] = useState(update?.showRevenue ?? false);
  const [showNetIncome, setShowNetIncome] = useState(update?.showNetIncome ?? false);
  const [selectedPeriod, setSelectedPeriod] = useState(
    update
      ? (periodOptions.find((o) => o.period === update.period && o.periodStartedOn === update.periodStartedOn)?.value ??
          "")
      : "",
  );
  const selectedPeriodOption = assertDefined(periodOptions.find((o) => o.value === selectedPeriod));
  const [modalOpen, setModalOpen] = useState(false);
  const [errors, setErrors] = useState<Set<string>>(new Set());
  const recipientCount = (company.contractorCount ?? 0) + (company.investorCount ?? 0);

  const createMutation = trpc.companyUpdates.create.useMutation();
  const updateMutation = trpc.companyUpdates.update.useMutation();
  const publishMutation = trpc.companyUpdates.publish.useMutation();
  const saveMutation = useMutation({
    mutationFn: async ({ publish, preview }: { publish: boolean; preview?: true }) => {
      if (!validateUpdate()) throw new Error("Validation failed");
      const data = {
        companyId: company.id,
        title,
        body,
        videoUrl,
        showRevenue,
        showNetIncome,
        period: selectedPeriodOption.period,
        periodStartedOn: selectedPeriodOption.periodStartedOn,
      };
      let id;
      if (update) {
        id = update.id;
        await updateMutation.mutateAsync({ ...data, id });
      } else {
        id = await createMutation.mutateAsync(data);
      }
      if (publish) await publishMutation.mutateAsync({ companyId: company.id, id });
      void trpcUtils.companyUpdates.list.invalidate();
      if (preview) {
        router.replace(`/updates/company/${id}/edit`);
        window.open(`/updates/company/${id}`, "_blank");
      } else {
        router.push(`/updates/company/${id}`);
      }
    },
  });

  const openConfirmationModal = () => {
    if (!validateUpdate()) return;
    setModalOpen(true);
  };

  const validateUpdate = () => {
    const newErrors = new Set<string>();
    if (!title.trim()) newErrors.add("title");
    if (/^(<p>\s*<\/p>)*$/u.test(body)) newErrors.add("body");
    setErrors(newErrors);
    return newErrors.size === 0;
  };

  return (
    <MainLayout
      title={id ? "Edit company update" : "New company update"}
      headerActions={
        update?.sentAt ? (
          <Button onClick={() => openConfirmationModal()}>
            <EnvelopeIcon className="size-4" />
            Update
          </Button>
        ) : (
          <>
            <MutationButton
              mutation={saveMutation}
              param={{ publish: false, preview: true }}
              idleVariant="outline"
              loadingText="Saving..."
            >
              <ArrowTopRightOnSquareIcon className="size-4" />
              Preview
            </MutationButton>
            <Button onClick={() => openConfirmationModal()}>
              <EnvelopeIcon className="size-4" />
              Publish
            </Button>
          </>
        )
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto]">
        <div className="grid gap-3">
          <Input
            value={title}
            onChange={(title) => {
              errors.delete("title");
              setTitle(title);
            }}
            label="Title"
            invalid={errors.has("title")}
          />
          <Select
            value={selectedPeriod}
            onChange={(value) => setSelectedPeriod(periodOptions.find((o) => o.value === value)?.value ?? "")}
            label="Financial overview"
            options={periodOptions}
          />
          {selectedPeriodOption.period && selectedPeriodOption.periodStartedOn ? (
            <FinancialOverview
              financialReports={financialReports}
              period={selectedPeriodOption.period}
              periodStartedOn={selectedPeriodOption.periodStartedOn}
              revenueTitle={<Checkbox switch label="Revenue" checked={showRevenue} onChange={setShowRevenue} />}
              netIncomeTitle={
                <Checkbox switch label="Net income" checked={showNetIncome} onChange={setShowNetIncome} />
              }
            />
          ) : null}
          <RichTextEditor
            value={body}
            onChange={(value) => {
              errors.delete("body");
              setBody(value);
            }}
            label="Update"
            invalid={errors.has("body")}
          />
          <Input value={videoUrl ?? ""} onChange={(videoUrl) => setVideoUrl(videoUrl)} label="Video URL (optional)" />
        </div>
        <div className="flex flex-col gap-2">
          <div className="mb-1 text-xs text-gray-500 uppercase">Recipients ({recipientCount.toLocaleString()})</div>
          {company.investorCount ? (
            <div className="flex items-center gap-2">
              <UsersIcon className="size-4" />
              <span>
                {company.investorCount.toLocaleString()} {pluralize("investor", company.investorCount)}
              </span>
            </div>
          ) : null}
          {company.contractorCount ? (
            <div className="flex items-center gap-2">
              <UsersIcon className="size-4" />
              <span>
                {company.contractorCount.toLocaleString()} active {pluralize("contractor", company.contractorCount)}
              </span>
            </div>
          ) : null}
        </div>
      </div>
      <Modal open={modalOpen} title="Publish update?" onClose={() => setModalOpen(false)}>
        {update?.sentAt ? (
          <p>Your update will be visible in Flexile. No new emails will be sent.</p>
        ) : (
          <p>Your update will be emailed to {recipientCount.toLocaleString()} stakeholders.</p>
        )}
        <div className="grid auto-cols-fr grid-flow-col items-center gap-3">
          <Button variant="outline" onClick={() => setModalOpen(false)}>
            No, cancel
          </Button>
          <MutationButton mutation={saveMutation} param={{ publish: !update?.sentAt }} loadingText="Sending...">
            Yes, {update?.sentAt ? "update" : "publish"}
          </MutationButton>
        </div>
      </Modal>
    </MainLayout>
  );
};

export default Edit;
