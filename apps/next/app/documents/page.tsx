"use client";
import { BriefcaseIcon, CheckCircleIcon, PaperAirplaneIcon } from "@heroicons/react/24/outline";
import { useMutation } from "@tanstack/react-query";
import { parseAsInteger, useQueryState } from "nuqs";
import React, { useState } from "react";
import Input from "@/components/Input";
import Modal from "@/components/Modal";
import MutationButton from "@/components/MutationButton";
import Placeholder from "@/components/Placeholder";
import Select from "@/components/Select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { trpc } from "@/trpc/client";
import { formatDate } from "@/utils/time";
import DocumentsLayout from "./Layout";
import DocumentsList from "./List";

export default function DocumentsPage() {
  const user = useCurrentUser();
  const company = useCurrentCompany();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const userId = user.activeRole === "administrator" ? null : user.id;
  const [years] = trpc.documents.years.useSuspenseQuery({ companyId: company.id, userId });
  const defaultYear = years[0] ?? new Date().getFullYear();
  const [year, setYear] = useQueryState("year", parseAsInteger.withDefault(defaultYear));

  const [lawyerEmail, setLawyerEmail] = useState("");
  const inviteLawyer = trpc.lawyers.invite.useMutation();
  const inviteLawyerMutation = useMutation({
    mutationFn: async () => {
      if (!lawyerEmail.trim()) throw new Error("Email is required");
      await inviteLawyer.mutateAsync({ companyId: company.id, email: lawyerEmail });
    },
    onSuccess: () => {
      setShowInviteModal(false);
      setLawyerEmail("");
    },
  });

  return (
    <DocumentsLayout
      headerActions={
        user.activeRole === "administrator" && company.flags.includes("lawyers") ? (
          <Button onClick={() => setShowInviteModal(true)}>
            <BriefcaseIcon className="size-4" />
            Invite lawyer
          </Button>
        ) : null
      }
    >
      <div className="grid gap-4">
        <div className="flex justify-between">
          <div>
            <Select
              ariaLabel="Filter by year"
              value={year.toString()}
              options={years.map((year) => ({ label: year.toString(), value: year.toString() }))}
              onChange={(value) => {
                void setYear(parseInt(value, 10));
              }}
            />
          </div>
        </div>
        <Documents year={year} />
      </div>
      <Modal open={showInviteModal} onClose={() => setShowInviteModal(false)} title="Who's joining?">
        <form>
          <Input
            value={lawyerEmail}
            onChange={(e) => setLawyerEmail(e)}
            label="Email"
            placeholder="Lawyer's email"
            type="email"
            invalid={inviteLawyerMutation.isError}
            help={inviteLawyerMutation.error?.message}
          />
          <MutationButton
            mutation={inviteLawyerMutation}
            className="mt-4 w-full"
            disabled={!lawyerEmail}
            loadingText="Inviting..."
          >
            <PaperAirplaneIcon className="size-5" />
            Invite
          </MutationButton>
        </form>
      </Modal>
    </DocumentsLayout>
  );
}

const useQuery = (year: number) => {
  const user = useCurrentUser();
  const company = useCurrentCompany();
  const userId = user.activeRole === "administrator" ? null : user.id;
  return trpc.documents.list.useSuspenseQuery({ companyId: company.id, userId, year });
};

function Documents({ year }: { year: number }) {
  const user = useCurrentUser();
  const company = useCurrentCompany();
  const currentYear = new Date().getFullYear();
  const userId = user.activeRole === "administrator" ? null : user.id;
  const [{ documents }] = useQuery(year);

  const filingDueDateFor1099NEC = new Date(currentYear, 0, 31);
  const filingDueDateFor1042S = new Date(currentYear, 2, 15);
  const filingDueDateFor1099DIV = new Date(currentYear, 2, 31);

  const isFilingDueDateApproaching = year === currentYear && new Date() <= filingDueDateFor1099DIV;

  return (
    <>
      {company.flags.includes("irs_tax_forms") && user.activeRole === "administrator" && isFilingDueDateApproaching ? (
        <Alert className="mb-4">
          <AlertTitle>Upcoming filing dates for 1099-NEC, 1099-DIV, and 1042-S</AlertTitle>
          <AlertDescription>
            We will submit form 1099-NEC to the IRS on {formatDate(filingDueDateFor1099NEC)}, form 1042-S on{" "}
            {formatDate(filingDueDateFor1042S)}, and form 1099-DIV on {formatDate(filingDueDateFor1099DIV)}.
          </AlertDescription>
        </Alert>
      ) : null}

      {documents.length > 0 ? (
        <DocumentsList userId={userId} documents={documents} />
      ) : (
        <Placeholder icon={CheckCircleIcon}>No documents for {year}.</Placeholder>
      )}
    </>
  );
}
