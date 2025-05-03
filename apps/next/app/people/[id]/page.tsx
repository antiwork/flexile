"use client";
import { ExclamationTriangleIcon } from "@heroicons/react/20/solid";
import { CheckCircleIcon, DocumentDuplicateIcon } from "@heroicons/react/24/outline";
import { useMutation } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/react-query";
import { formatISO, isFuture } from "date-fns";
import { Decimal } from "decimal.js";
import { useParams, useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import React, { useEffect, useMemo, useState } from "react";
import DividendStatusIndicator from "@/app/equity/DividendStatusIndicator";
import EquityGrantExerciseStatusIndicator from "@/app/equity/EquityGrantExerciseStatusIndicator";
import DetailsModal from "@/app/equity/grants/DetailsModal";
import RoleSelector from "@/app/roles/Selector";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import FormSection from "@/components/FormSection";
import Input from "@/components/Input";
import MainLayout from "@/components/layouts/Main";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import MutationButton from "@/components/MutationButton";
import NumberInput from "@/components/NumberInput";
import Placeholder from "@/components/Placeholder";
import Status from "@/components/Status";
import Tabs from "@/components/Tabs";
import { Tooltip, TooltipContent, TooltipPortal, TooltipTrigger } from "@/components/Tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { DEFAULT_WORKING_HOURS_PER_WEEK, MAXIMUM_EQUITY_PERCENTAGE, MINIMUM_EQUITY_PERCENTAGE } from "@/models";
import type { RouterOutput } from "@/trpc";
import { PayRateType, trpc } from "@/trpc/client";
import { assertDefined } from "@/utils/assert";
import { formatMoney, formatMoneyFromCents } from "@/utils/formatMoney";
import { request } from "@/utils/request";
import { approve_company_invoices_path, company_equity_exercise_payment_path } from "@/utils/routes";
import { formatDate } from "@/utils/time";

export default function ContractorPage() {
  const currentUser = useCurrentUser();
  const company = useCurrentCompany();
  const router = useRouter();
  const trpcUtils = trpc.useUtils();
  const { id } = useParams<{ id: string }>();
  const [user] = trpc.users.get.useSuspenseQuery({ companyId: company.id, id });
  const { data: contractor, refetch } = trpc.contractors.get.useQuery(
    { companyId: company.id, userId: id },
    { enabled: !!currentUser.roles.administrator },
  );
  const { data: investor } = trpc.investors.get.useQuery({ companyId: company.id, userId: id });
  const { data: equityGrants } = trpc.equityGrants.list.useQuery(
    { companyId: company.id, investorId: investor?.id ?? "" },
    { enabled: !!investor },
  );
  const { data: shareHoldings } = trpc.shareHoldings.list.useQuery(
    { companyId: company.id, investorId: investor?.id ?? "" },
    { enabled: !!investor },
  );
  const { data: dividends } = trpc.dividends.list.useQuery(
    { companyId: company.id, investorId: investor?.id ?? "" },
    { enabled: !!investor },
  );
  const { data: equityGrantExercises } = trpc.equityGrantExercises.list.useQuery(
    { companyId: company.id, investorId: investor?.id ?? "" },
    { enabled: !!investor },
  );
  const { data: convertiblesData } = trpc.convertibleSecurities.list.useQuery(
    { companyId: company.id, investorId: investor?.id ?? "" },
    { enabled: !!investor },
  );

  const [selectedRoleId, setSelectedRoleId] = useState(contractor?.role ?? "");
  useEffect(() => setSelectedRoleId(contractor?.role ?? ""), [contractor]);
  const [endModalOpen, setEndModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [endDate, setEndDate] = useState(formatISO(new Date(), { representation: "date" }));
  const [issuePaymentModalOpen, setIssuePaymentModalOpen] = useState(false);
  const [paymentAmountInCents, setPaymentAmountInCents] = useState<number | null>(null);
  const [paymentDescription, setPaymentDescription] = useState("");
  const [equityType, setEquityType] = useState<"fixed" | "range">("fixed");
  const [fixedEquityPercentage, setFixedEquityPercentage] = useState<number | null>(null);
  const [equityRange, setEquityRange] = useState<[number, number]>([
    MINIMUM_EQUITY_PERCENTAGE,
    MAXIMUM_EQUITY_PERCENTAGE,
  ]);
  const [issuePaymentError, setIssuePaymentError] = useState<string | null>(null);
  const hasValidPaymentInfo = () => {
    let valid = paymentAmountInCents && paymentAmountInCents !== 0 && paymentDescription.length !== 0;
    if (!valid) return false;
    if (!company.flags.includes("equity_compensation")) return true;

    if (equityType === "fixed") {
      valid =
        fixedEquityPercentage !== null &&
        fixedEquityPercentage >= MINIMUM_EQUITY_PERCENTAGE &&
        fixedEquityPercentage <= MAXIMUM_EQUITY_PERCENTAGE;
    } else {
      valid = equityRange[0] >= MINIMUM_EQUITY_PERCENTAGE && equityRange[1] <= MAXIMUM_EQUITY_PERCENTAGE;
    }
    return valid;
  };

  const tabs = [
    contractor && ({ label: "Details", tab: `details` } as const),
    equityGrants?.length ? ({ label: "Options", tab: `options` } as const) : null,
    shareHoldings?.length ? ({ label: "Shares", tab: `shares` } as const) : null,
    convertiblesData?.convertibleSecurities.length ? ({ label: "Convertibles", tab: `convertibles` } as const) : null,
    equityGrantExercises?.length ? ({ label: "Exercises", tab: `exercises` } as const) : null,
    dividends?.length ? ({ label: "Dividends", tab: `dividends` } as const) : null,
  ].filter((link) => !!link);
  const [selectedTab] = useQueryState("tab", parseAsString.withDefault(tabs[0]?.tab ?? ""));

  const endContract = trpc.contractors.endContract.useMutation();
  const cancelContractEnd = trpc.contractors.cancelContractEnd.useMutation();
  const cancelContractEndMutation = useMutation({
    mutationFn: async () => {
      if (!contractor) return;

      await cancelContractEnd.mutateAsync({
        companyId: company.id,
        id: contractor.id,
      });
      await trpcUtils.contractors.list.invalidate({ companyId: company.id });
      await refetch();
      setCancelModalOpen(false);
    },
  });

  const endContractMutation = useMutation({
    mutationFn: async () => {
      if (!contractor) return;

      await endContract.mutateAsync({
        companyId: company.id,
        id: contractor.id,
        endDate,
      });
      await trpcUtils.contractors.list.invalidate({ companyId: company.id });
      await refetch();
      router.push(`/people`);
    },
  });

  const closeIssuePaymentModal = () => {
    setIssuePaymentModalOpen(false);
    setPaymentAmountInCents(null);
    setPaymentDescription("");
    setEquityType("fixed");
    setFixedEquityPercentage(null);
    setEquityRange([MINIMUM_EQUITY_PERCENTAGE, MAXIMUM_EQUITY_PERCENTAGE]);
  };
  const issuePayment = trpc.invoices.createAsAdmin.useMutation();
  const issuePaymentMutation = useMutation({
    mutationFn: async () => {
      if (!hasValidPaymentInfo()) return;

      let invoice;
      try {
        const equityAttributes = (() => {
          if (!company.flags.includes("equity_compensation")) {
            return {
              equityPercentage: 0,
              minAllowedEquityPercentage: null,
              maxAllowedEquityPercentage: null,
            };
          }

          if (equityType === "fixed") {
            return {
              equityPercentage: fixedEquityPercentage ?? 0,
              minAllowedEquityPercentage: null,
              maxAllowedEquityPercentage: null,
            };
          }

          return {
            equityPercentage: equityRange[0],
            minAllowedEquityPercentage: equityRange[0],
            maxAllowedEquityPercentage: equityRange[1],
          };
        })();

        invoice = await issuePayment.mutateAsync({
          ...equityAttributes,
          companyId: company.id,
          userExternalId: id,
          totalAmountCents: BigInt(assertDefined(paymentAmountInCents)),
          description: paymentDescription,
        });
      } catch (error) {
        setIssuePaymentError(error instanceof TRPCClientError ? error.message : "Something went wrong");
        throw error;
      }

      await request({
        method: "PATCH",
        url: approve_company_invoices_path(company.id),
        accept: "json",
        jsonData:
          company.requiredInvoiceApprovals > 1
            ? { approve_ids: [invoice.externalId] }
            : { pay_ids: [invoice.externalId] },
        assertOk: true,
      });
      await trpcUtils.invoices.list.invalidate({ companyId: company.id });
      closeIssuePaymentModal();
    },
    onSettled: () => {
      issuePaymentMutation.reset();
    },
  });

  return (
    <MainLayout
      title={user.displayName}
      headerActions={
        contractor ? (
          <div className="flex items-center gap-3">
            <Button onClick={() => setIssuePaymentModalOpen(true)}>Issue payment</Button>
            {contractor.endedAt && !isFuture(contractor.endedAt) ? (
              <Status variant="critical">Alumni</Status>
            ) : !contractor.endedAt || isFuture(contractor.endedAt) ? (
              <Button variant="outline" onClick={() => setEndModalOpen(true)}>
                End contract
              </Button>
            ) : null}
          </div>
        ) : null
      }
    >
      <Dialog open={endModalOpen} onOpenChange={setEndModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End contract with {user.displayName}?</DialogTitle>
          </DialogHeader>
          <p>This action cannot be undone.</p>
          <Input type="date" label="End date" value={endDate} onChange={setEndDate} />
          <div className="grid gap-3">
            <Status variant="success">{user.displayName} will be able to submit invoices after contract end.</Status>
            <Status variant="success">{user.displayName} will receive upcoming payments.</Status>
            <Status variant="success">
              {user.displayName} will be able to see and download their invoice history.
            </Status>
            <Status variant="critical">
              {user.displayName} won't see any of {company.name}'s information.
            </Status>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEndModalOpen(false)}>
              No, cancel
            </Button>
            <MutationButton mutation={endContractMutation}>Yes, end contract</MutationButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel contract end with {user.displayName}?</DialogTitle>
          </DialogHeader>
          <p>This will remove the scheduled end date for this contract.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelModalOpen(false)}>
              No, keep end date
            </Button>
            <MutationButton mutation={cancelContractEndMutation}>Yes, cancel contract end</MutationButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={issuePaymentModalOpen} onOpenChange={closeIssuePaymentModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue one-time payment</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="payment-amount">Amount</Label>
              <NumberInput
                id="payment-amount"
                value={paymentAmountInCents ? paymentAmountInCents / 100 : null}
                onChange={(value) => {
                  if (value !== null) {
                    const cents = new Decimal(value).mul(100).toNumber();
                    setPaymentAmountInCents(cents);
                  } else {
                    setPaymentAmountInCents(null);
                  }
                }}
                placeholder="Enter amount"
                prefix="$"
                decimal
              />
            </div>
            <Input
              value={paymentDescription}
              onChange={setPaymentDescription}
              label="What is this for?"
              placeholder="Enter payment description"
            />
            {company.flags.includes("equity_compensation") ? (
              <div className="space-y-4">
                <div className="flex flex-col gap-2">
                  <Label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="equityType"
                      checked={equityType === "fixed"}
                      onChange={() => setEquityType("fixed")}
                      className="h-4 w-4"
                    />
                    Fixed equity percentage
                  </Label>
                  <Label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="equityType"
                      checked={equityType === "range"}
                      onChange={() => setEquityType("range")}
                      className="h-4 w-4"
                    />
                    Equity percentage range
                  </Label>
                </div>

                {equityType === "fixed" ? (
                  <NumberInput
                    value={fixedEquityPercentage}
                    onChange={setFixedEquityPercentage}
                    placeholder="Enter percentage"
                    suffix="%"
                  />
                ) : (
                  <div className="space-y-2">
                    <Slider
                      defaultValue={[equityRange[0], equityRange[1]]}
                      minStepsBetweenThumbs={1}
                      onValueChange={([min, max]) => setEquityRange([min ?? equityRange[0], max ?? equityRange[1]])}
                    />
                    <div className="flex justify-between text-gray-600">
                      <span>{(equityRange[0] / 100).toLocaleString(undefined, { style: "percent" })}</span>
                      <span>{(equityRange[1] / 100).toLocaleString(undefined, { style: "percent" })}</span>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {issuePaymentError ? <small className="text-red">{issuePaymentError}</small> : null}

          <small className="text-gray-600">
            Your'll be able to initiate payment once it has been accepted by the recipient
            {company.requiredInvoiceApprovals > 1 ? " and has sufficient approvals" : ""}.
          </small>

          <DialogFooter>
            <div className="flex justify-end">
              <MutationButton
                mutation={issuePaymentMutation}
                successText="Payment submitted!"
                loadingText="Saving..."
                disabled={!hasValidPaymentInfo()}
              >
                Issue payment
              </MutationButton>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs links={tabs.map((tab) => ({ label: tab.label, route: `?tab=${tab.tab}` }))} />

      {(() => {
        switch (selectedTab) {
          case "options":
            return investor ? <OptionsTab investorId={investor.id} userId={id} /> : null;
          case "shares":
            return investor ? <SharesTab investorId={investor.id} /> : null;
          case "convertibles":
            return investor ? <ConvertiblesTab investorId={investor.id} /> : null;
          case "exercises":
            return investor ? <ExercisesTab investorId={investor.id} /> : null;
          case "dividends":
            return investor ? <DividendsTab investorId={investor.id} /> : null;
          case "details":
            return (
              <DetailsTab
                userId={id}
                selectedRoleId={selectedRoleId}
                setSelectedRoleId={setSelectedRoleId}
                setCancelModalOpen={setCancelModalOpen}
              />
            );
        }
      })()}
    </MainLayout>
  );
}

const DetailsTab = ({
  userId,
  selectedRoleId,
  setSelectedRoleId,
  setCancelModalOpen,
}: {
  userId: string;
  selectedRoleId: string;
  setSelectedRoleId: (id: string) => void;
  setCancelModalOpen: (open: boolean) => void;
}) => {
  const company = useCurrentCompany();
  const router = useRouter();
  const [user] = trpc.users.get.useSuspenseQuery({ companyId: company.id, id: userId });
  const [contractor] = trpc.contractors.get.useSuspenseQuery({ companyId: company.id, userId });
  const [roles] = trpc.roles.list.useSuspenseQuery({ companyId: company.id });
  const [payRateInSubunits, setPayRateInSubunits] = useState(contractor.payRateInSubunits);
  const [hoursPerWeek, setHoursPerWeek] = useState(contractor.hoursPerWeek);
  const selectedRole = roles.find((role) => role.id === selectedRoleId);
  useEffect(() => {
    if (selectedRole && selectedRoleId !== contractor.role) setPayRateInSubunits(selectedRole.payRateInSubunits);
  }, [selectedRole]);
  useEffect(() => {
    setPayRateInSubunits(contractor.payRateInSubunits);
    setHoursPerWeek(contractor.hoursPerWeek);
  }, [contractor]);
  const trpcUtils = trpc.useUtils();
  const updateContractor = trpc.contractors.update.useMutation({
    onSuccess: async (data) => {
      await trpcUtils.contractors.list.invalidate();
      await trpcUtils.documents.list.invalidate();
      await trpcUtils.contractors.get.invalidate({ userId });
      return router.push(data.documentId ? `/documents?sign=${data.documentId}` : "/people");
    },
  });

  return (
    <>
      <FormSection title="Contract">
        <CardContent>
          <div className="grid gap-4">
            {contractor.endedAt ? (
              <Alert variant="destructive">
                <ExclamationTriangleIcon />
                <AlertDescription>
                  <div className="flex items-center justify-between">
                    Contract {isFuture(contractor.endedAt) ? "ends" : "ended"} on {formatDate(contractor.endedAt)}.
                    {isFuture(contractor.endedAt) && (
                      <Button variant="outline" onClick={() => setCancelModalOpen(true)}>
                        Cancel contract end
                      </Button>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            ) : null}
            <RoleSelector value={selectedRoleId} onChange={setSelectedRoleId} />
            <div className="grid items-start gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="pay-rate">Rate</Label>
                <NumberInput
                  id="pay-rate"
                  value={payRateInSubunits / 100}
                  onChange={(value) => setPayRateInSubunits((value ?? 0) * 100)}
                  placeholder="0"
                  disabled={!!contractor.endedAt}
                  prefix="$"
                  suffix={
                    contractor.payRateType === PayRateType.ProjectBased
                      ? "/ project"
                      : hoursPerWeek === null
                        ? "/ year"
                        : "/ hour"
                  }
                  decimal
                />
              </div>
              {contractor.payRateType !== PayRateType.ProjectBased && hoursPerWeek !== null && (
                <div className="grid gap-2">
                  <Label htmlFor="hours-per-week">Average hours</Label>
                  <NumberInput
                    id="hours-per-week"
                    value={hoursPerWeek}
                    onChange={(value) => setHoursPerWeek(value ?? 0)}
                    placeholder={DEFAULT_WORKING_HOURS_PER_WEEK.toString()}
                    disabled={!!contractor.endedAt}
                    suffix="/ week"
                  />
                </div>
              )}
            </div>
            {contractor.payRateType !== PayRateType.ProjectBased && company.flags.includes("equity_compensation") && (
              <div>
                <span>Equity split</span>
                <div className="my-2 flex h-2 overflow-hidden rounded-xs bg-gray-200">
                  <div
                    style={{ width: `${contractor.equityPercentage}%` }}
                    className="flex flex-col justify-center bg-blue-600 whitespace-nowrap"
                  ></div>
                  <div
                    style={{ width: `${100 - contractor.equityPercentage}%` }}
                    className="flex flex-col justify-center"
                  ></div>
                </div>
                <div className="flex justify-between">
                  <span>
                    {(contractor.equityPercentage / 100).toLocaleString(undefined, { style: "percent" })} Equity{" "}
                    <span className="text-gray-600">
                      ({formatMoneyFromCents((contractor.equityPercentage * payRateInSubunits) / 100)})
                    </span>
                  </span>
                  <span>
                    {((100 - contractor.equityPercentage) / 100).toLocaleString(undefined, { style: "percent" })} Cash{" "}
                    <span className="text-gray-600">
                      ({formatMoneyFromCents(((100 - contractor.equityPercentage) * payRateInSubunits) / 100)})
                    </span>
                  </span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
        {!contractor.endedAt && (
          <CardFooter>
            <MutationButton
              size="small"
              mutation={updateContractor}
              param={{
                companyId: company.id,
                id: contractor.id,
                payRateType: selectedRole?.payRateType ?? contractor.payRateType,
                hoursPerWeek,
                payRateInSubunits,
                roleId: selectedRole?.id,
              }}
              disabled={
                contractor.payRateType === PayRateType.ProjectBased
                  ? !payRateInSubunits
                  : !(hoursPerWeek && payRateInSubunits)
              }
              loadingText="Saving..."
            >
              Save changes
            </MutationButton>
          </CardFooter>
        )}
      </FormSection>
      <FormSection title="Personal info">
        <CardContent>
          <div className="grid gap-4">
            <Input
              value={user.email}
              label="Email"
              disabled
              suffix={
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="link"
                      aria-label="Copy Email"
                      onClick={() => void navigator.clipboard.writeText(user.email)}
                    >
                      <DocumentDuplicateIcon className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipPortal>
                    <TooltipContent>Copy to clipboard</TooltipContent>
                  </TooltipPortal>
                </Tooltip>
              }
            />
            <Input value={user.legalName} label="Legal name" disabled />
            <div className="grid gap-3 md:grid-cols-2">
              <Input value={user.preferredName} label="Preferred name" disabled />
              <Input value={user.businessName ?? ""} label="Billing entity name" disabled />
            </div>
            <Input value={user.address.streetAddress} label="Residential address (street name, number, apt)" disabled />
            <div className="grid gap-3 md:grid-cols-2">
              <Input value={user.address.city} label="City or town, state or province" disabled />
              <Input value={user.address.zipCode} label="Postal code" disabled />
            </div>
            <Input value={user.address.countryCode} label="Country of residence" disabled />
          </div>
        </CardContent>
      </FormSection>
    </>
  );
};

const sharesColumnHelper = createColumnHelper<ShareHolding>();
const sharesColumns = [
  sharesColumnHelper.simple("issuedAt", "Issue date", formatDate),
  sharesColumnHelper.simple("shareClassName", "Type"),
  sharesColumnHelper.simple("numberOfShares", "Number of shares", (value) => value.toLocaleString(), "numeric"),
  sharesColumnHelper.simple(
    "sharePriceUsd",
    "Share price",
    (value) => formatMoney(value, { precise: true }),
    "numeric",
  ),
  sharesColumnHelper.simple("totalAmountInCents", "Cost", formatMoneyFromCents, "numeric"),
];

type ShareHolding = RouterOutput["shareHoldings"]["list"][number];
function SharesTab({ investorId }: { investorId: string }) {
  const company = useCurrentCompany();
  const [shareHoldings] = trpc.shareHoldings.list.useSuspenseQuery({ companyId: company.id, investorId });

  const table = useTable({ data: shareHoldings, columns: sharesColumns });

  return shareHoldings.length > 0 ? (
    <DataTable table={table} />
  ) : (
    <Placeholder icon={CheckCircleIcon}>This investor does not hold any shares.</Placeholder>
  );
}

const optionsColumnHelper = createColumnHelper<EquityGrant>();
const optionsColumns = [
  optionsColumnHelper.simple("issuedAt", "Issue date", formatDate),
  optionsColumnHelper.simple("numberOfShares", "Granted", (value) => value.toLocaleString(), "numeric"),
  optionsColumnHelper.simple("vestedShares", "Vested", (value) => value.toLocaleString(), "numeric"),
  optionsColumnHelper.simple("unvestedShares", "Unvested", (value) => value.toLocaleString(), "numeric"),
  optionsColumnHelper.simple("exercisedShares", "Exercised", (value) => value.toLocaleString(), "numeric"),
  optionsColumnHelper.simple(
    "exercisePriceUsd",
    "Exercise price",
    (value) => formatMoney(value, { precise: true }),
    "numeric",
  ),
];

type EquityGrant = RouterOutput["equityGrants"]["list"][number];
function OptionsTab({ investorId, userId }: { investorId: string; userId: string }) {
  const company = useCurrentCompany();
  const [equityGrants] = trpc.equityGrants.list.useSuspenseQuery({ companyId: company.id, investorId });
  const table = useTable({ data: equityGrants, columns: optionsColumns });

  const [selectedEquityGrant, setSelectedEquityGrant] = useState<EquityGrant | null>(null);

  return equityGrants.length > 0 ? (
    <>
      <DataTable table={table} onRowClicked={setSelectedEquityGrant} />
      {selectedEquityGrant ? (
        <DetailsModal
          equityGrant={selectedEquityGrant}
          userId={userId}
          canExercise={false}
          onClose={() => setSelectedEquityGrant(null)}
        />
      ) : null}
    </>
  ) : (
    <Placeholder icon={CheckCircleIcon}>This investor does not have any option grants.</Placeholder>
  );
}

type EquityGrantExercise = RouterOutput["equityGrantExercises"]["list"][number];
function ExercisesTab({ investorId }: { investorId: string }) {
  const company = useCurrentCompany();
  const trpcUtils = trpc.useUtils();
  const [exercises] = trpc.equityGrantExercises.list.useSuspenseQuery({ companyId: company.id, investorId });
  const confirmPaymentMutation = useMutation({
    mutationFn: async (exerciseId: EquityGrantExercise["id"]) => {
      await request({
        method: "PATCH",
        url: company_equity_exercise_payment_path(company.id, Number(exerciseId)),
        accept: "json",
        assertOk: true,
      });
      await trpcUtils.equityGrantExercises.list.invalidate();
    },
  });
  const columnHelper = createColumnHelper<EquityGrantExercise>();
  const columns = useMemo(
    () => [
      columnHelper.simple("requestedAt", "Request date", formatDate),
      columnHelper.simple("numberOfOptions", "Number of shares", (value) => value.toLocaleString(), "numeric"),
      columnHelper.simple("totalCostCents", "Cost", formatMoneyFromCents, "numeric"),
      columnHelper.accessor("status", {
        header: "Status",
        cell: (info) => <EquityGrantExerciseStatusIndicator status={info.getValue()} />,
      }),
      columnHelper.display({
        id: "actions",
        cell: (info) =>
          info.row.original.status === "signed" ? (
            <MutationButton mutation={confirmPaymentMutation} param={info.row.original.id} size="small">
              Confirm payment
            </MutationButton>
          ) : undefined,
      }),
    ],
    [],
  );
  const table = useTable({ data: exercises, columns });

  return exercises.length > 0 ? (
    <DataTable table={table} />
  ) : (
    <Placeholder icon={CheckCircleIcon}>This investor has not exercised any options.</Placeholder>
  );
}

type ConvertibleSecurity = RouterOutput["convertibleSecurities"]["list"]["convertibleSecurities"][number];
const convertiblesColumnHelper = createColumnHelper<ConvertibleSecurity>();
const convertiblesColumns = [
  convertiblesColumnHelper.simple("issuedAt", "Issue date", formatDate),
  convertiblesColumnHelper.simple("convertibleType", "Type"),
  convertiblesColumnHelper.simple("companyValuationInDollars", "Pre-money valuation cap", formatMoney),
  convertiblesColumnHelper.simple(
    "principalValueInCents",
    "Investment amount",
    (v) => formatMoneyFromCents(v),
    "numeric",
  ),
];
function ConvertiblesTab({ investorId }: { investorId: string }) {
  const company = useCurrentCompany();
  const [convertibles] = trpc.convertibleSecurities.list.useSuspenseQuery({ companyId: company.id, investorId });
  const table = useTable({ data: convertibles.convertibleSecurities, columns: convertiblesColumns });

  return convertibles.totalCount > 0 ? (
    <DataTable table={table} />
  ) : (
    <Placeholder icon={CheckCircleIcon}>This investor does not hold any convertible securities.</Placeholder>
  );
}

type Dividend = RouterOutput["dividends"]["list"][number];
const dividendsColumnHelper = createColumnHelper<Dividend>();
const dividendsColumns = [
  dividendsColumnHelper.simple("dividendRound.issuedAt", "Issue date", formatDate),
  dividendsColumnHelper.simple("numberOfShares", "Shares", (value) => value?.toLocaleString(), "numeric"),
  dividendsColumnHelper.simple("totalAmountInCents", "Amount", formatMoneyFromCents, "numeric"),
  dividendsColumnHelper.accessor("status", {
    header: "Status",
    cell: (info) => (
      <Tooltip>
        <TooltipTrigger>
          <DividendStatusIndicator status={info.getValue()} />
        </TooltipTrigger>
        <TooltipContent>
          {info.row.original.status === "Retained"
            ? info.row.original.retainedReason === "ofac_sanctioned_country"
              ? "This dividend is retained due to US sanctions."
              : info.row.original.retainedReason === "below_minimum_payment_threshold"
                ? "This dividend didn't meet the payout threshold set."
                : null
            : null}
        </TooltipContent>
      </Tooltip>
    ),
  }),
];
function DividendsTab({ investorId }: { investorId: string }) {
  const company = useCurrentCompany();
  const [dividends] = trpc.dividends.list.useSuspenseQuery({ companyId: company.id, investorId });
  const table = useTable({ data: dividends, columns: dividendsColumns });

  return dividends.length > 0 ? (
    <DataTable table={table} />
  ) : (
    <Placeholder icon={CheckCircleIcon}>This investor hasn't received any dividends yet.</Placeholder>
  );
}
