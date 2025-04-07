"use client";
import { BriefcaseIcon, CheckCircleIcon, PaperAirplaneIcon } from "@heroicons/react/24/outline";
import { useMutation } from "@tanstack/react-query";
import { parseAsInteger, useQueryState } from "nuqs";
import Button from "@/components/Button";
import Input from "@/components/Input";
import Modal from "@/components/Modal";
import MutationButton from "@/components/MutationButton";
import PaginationSection, { usePage } from "@/components/PaginationSection";
import Placeholder from "@/components/Placeholder";
import Select from "@/components/Select";
import Sheet from "@/components/Sheet";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { trpc } from "@/trpc/client";
import { formatDate } from "@/utils/time";
import DocumentsLayout from "./Layout";
import DocumentsList from "./List";
import React, { useState } from "react";

export default function DocumentsPage() {
  const user = useCurrentUser();
  const company = useCurrentCompany();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [_, setPage] = usePage();
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
                void setPage(1);
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

const perPage = 50;
const useQuery = (year: number) => {
  const user = useCurrentUser();
  const company = useCurrentCompany();
  const userId = user.activeRole === "administrator" ? null : user.id;
  const [page] = usePage();
  return trpc.documents.list.useSuspenseQuery({ companyId: company.id, userId, year, perPage, page });
};

function Documents({ year }: { year: number }) {
  const user = useCurrentUser();
  const company = useCurrentCompany();
  const currentYear = new Date().getFullYear();
  const userId = user.activeRole === "administrator" ? null : user.id;
  const [{ documents, total }] = useQuery(year);

  const filingDueDateFor1099NEC = new Date(currentYear, 0, 31);
  const filingDueDateFor1042S = new Date(currentYear, 2, 15);
  const filingDueDateFor1099DIV = new Date(currentYear, 2, 31);

  const isFilingDueDateApproaching = year === currentYear && new Date() <= filingDueDateFor1099DIV;

  return (
    <>
      {documents.length > 0 ? (
        <>
          <DocumentsList userId={userId} documents={documents} />
          <PaginationSection total={total} perPage={perPage} />
        </>
      ) : (
        <Placeholder icon={CheckCircleIcon}>No documents for {year}.</Placeholder>
      )}

      {company.flags.includes("irs_tax_forms") && user.activeRole === "administrator" && isFilingDueDateApproaching ? (
        <Sheet>
          <h2 className="text-xl font-bold">Upcoming filing dates for 1099-NEC, 1099-DIV, and 1042-S</h2>
          <p>
            We will submit form 1099-NEC to the IRS on {formatDate(filingDueDateFor1099NEC)}, form 1042-S on{" "}
            {formatDate(filingDueDateFor1042S)}, and form 1099-DIV on {formatDate(filingDueDateFor1099DIV)}.
          </p>
        </Sheet>
      ) : null}
    </>
  );
}
