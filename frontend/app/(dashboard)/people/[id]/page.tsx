"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { getLocalTimeZone, today } from "@internationalized/date";
import { useMutation } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/react-query";
import { isFuture } from "date-fns";
import { Decimal } from "decimal.js";
import { AlertTriangle, CircleCheck, Copy } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import React, { useMemo, useState } from "react";
import type { DateValue } from "react-aria-components";
import { useForm } from "react-hook-form";
import { z } from "zod";
import DividendStatusIndicator from "@/app/(dashboard)/equity/DividendStatusIndicator";
import EquityGrantExerciseStatusIndicator from "@/app/(dashboard)/equity/EquityGrantExerciseStatusIndicator";
import DetailsModal from "@/app/(dashboard)/equity/grants/DetailsModal";
import CopyButton from "@/components/CopyButton";
import { DashboardHeader } from "@/components/DashboardHeader";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import DatePicker from "@/components/DatePicker";
import MutationButton, { MutationStatusButton } from "@/components/MutationButton";
import NumberInput from "@/components/NumberInput";
import Placeholder from "@/components/Placeholder";
import RadioButtons from "@/components/RadioButtons";
import Status from "@/components/Status";
import Tabs from "@/components/Tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { MAXIMUM_EQUITY_PERCENTAGE, MINIMUM_EQUITY_PERCENTAGE } from "@/models";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { formatMoney, formatMoneyFromCents } from "@/utils/formatMoney";
import { request } from "@/utils/request";
import { approve_company_invoices_path, company_equity_exercise_payment_path } from "@/utils/routes";
import { formatDate } from "@/utils/time";
import FormFields, { schema as formSchema } from "../FormFields";

const issuePaymentSchema = z.object({
  amountInCents: z.number().min(0),
  description: z.string().min(1, "This field is required"),
  equityType: z.enum(["fixed", "range"]),
  equityPercentage: z.number().min(MINIMUM_EQUITY_PERCENTAGE).max(MAXIMUM_EQUITY_PERCENTAGE),
  equityRange: z.tuple([z.number().min(MINIMUM_EQUITY_PERCENTAGE), z.number().max(MAXIMUM_EQUITY_PERCENTAGE)]),
});

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

  const [endModalOpen, setEndModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [endDate, setEndDate] = useState<DateValue | null>(today(getLocalTimeZone()));
  const [issuePaymentModalOpen, setIssuePaymentModalOpen] = useState(false);
  const issuePaymentForm = useForm({
    defaultValues: {
      equityType: "fixed",
      equityPercentage: 0,
      equityRange: [MINIMUM_EQUITY_PERCENTAGE, MAXIMUM_EQUITY_PERCENTAGE],
    },
    resolver: zodResolver(issuePaymentSchema),
  });

  const tabs = [
    contractor && ({ label: "Details", tab: `details` } as const),
    equityGrants?.length ? ({ label: "Options", tab: `options` } as const) : null,
    shareHoldings?.length ? ({ label: "Shares", tab: `shares` } as const) : null,
    convertiblesData?.convertibleSecurities.length ? ({ label: "Convertibles", tab: `convertibles` } as const) : null,
    equityGrantExercises?.length ? ({ label: "Exercises", tab: `exercises` } as const) : null,
    dividends?.length ? ({ label: "Dividends", tab: `dividends` } as const) : null,
  ].filter((link) => !!link);
  const [selectedTab] = useQueryState("tab", parseAsString.withDefault(tabs[0]?.tab ?? ""));

  const endContract = trpc.contractors.endContract.useMutation({
    onSuccess: async () => {
      await trpcUtils.contractors.list.invalidate({ companyId: company.id });
      await refetch();
      router.push(`/people`);
    },
  });
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

  const closeIssuePaymentModal = () => {
    setIssuePaymentModalOpen(false);
    issuePaymentForm.reset();
  };
  const issuePayment = trpc.invoices.createAsAdmin.useMutation();
  const issuePaymentMutation = useMutation({
    mutationFn: async (values: z.infer<typeof issuePaymentSchema>) => {
      const invoice = await issuePayment.mutateAsync({
        ...(values.equityType === "range"
          ? {
              ...values,
              equityPercentage: values.equityRange[0],
              minAllowedEquityPercentage: values.equityRange[0],
              maxAllowedEquityPercentage: values.equityRange[1],
            }
          : values),
        companyId: company.id,
        userExternalId: id,
        totalAmountCents: BigInt(values.amountInCents),
      });
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
      await trpcUtils.invoices.get.invalidate({ companyId: company.id, id: invoice.externalId });
      closeIssuePaymentModal();
    },
    onError: (error) => {
      issuePaymentForm.setError("root", {
        message: error instanceof TRPCClientError ? error.message : "Something went wrong",
      });
    },
  });
  const issuePaymentValues = issuePaymentForm.watch();
  const submitIssuePayment = issuePaymentForm.handleSubmit((values) => issuePaymentMutation.mutateAsync(values));

  return (
    <>
      <DashboardHeader
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
      />

      <Dialog open={endModalOpen} onOpenChange={setEndModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End contract with {user.displayName}?</DialogTitle>
          </DialogHeader>
          <p>This action cannot be undone.</p>
          <div className="grid gap-2">
            <DatePicker value={endDate} onChange={setEndDate} label="End date" granularity="day" />
          </div>
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
            <MutationButton
              mutation={endContract}
              param={{ companyId: company.id, id: contractor?.id ?? "", endDate: endDate?.toString() ?? "" }}
            >
              Yes, end contract
            </MutationButton>
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
          <Form {...issuePaymentForm}>
            <form onSubmit={(e) => void submitIssuePayment(e)} className="grid gap-4">
              <FormField
                control={issuePaymentForm.control}
                name="amountInCents"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                      <NumberInput
                        {...field}
                        value={field.value ? field.value / 100 : null}
                        onChange={(value) =>
                          field.onChange(value == null ? null : new Decimal(value).mul(100).toNumber())
                        }
                        prefix="$"
                        decimal
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={issuePaymentForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>What is this for?</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter payment description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {company.flags.includes("equity") ? (
                <div className="space-y-4">
                  <FormField
                    control={issuePaymentForm.control}
                    name="equityType"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <RadioButtons
                            {...field}
                            options={[
                              { label: "Fixed equity percentage", value: "fixed" },
                              { label: "Equity percentage range", value: "range" },
                            ]}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={issuePaymentForm.control}
                    name="equityPercentage"
                    render={({ field }) => (
                      <FormItem hidden={issuePaymentValues.equityType === "range"}>
                        <FormLabel>Equity percentage</FormLabel>
                        <FormControl>
                          <NumberInput {...field} suffix="%" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={issuePaymentForm.control}
                    name="equityRange"
                    render={({ field }) => (
                      <FormItem hidden={issuePaymentValues.equityType === "fixed"}>
                        <FormControl>
                          <Slider value={field.value} minStepsBetweenThumbs={1} onValueChange={field.onChange} />
                        </FormControl>
                        <FormMessage>
                          <div className="flex justify-between">
                            <span>{(field.value[0] / 100).toLocaleString(undefined, { style: "percent" })}</span>
                            <span>{(field.value[1] / 100).toLocaleString(undefined, { style: "percent" })}</span>
                          </div>
                        </FormMessage>
                      </FormItem>
                    )}
                  />
                </div>
              ) : null}

              {issuePaymentForm.formState.errors.root ? (
                <small className="text-red">{issuePaymentForm.formState.errors.root.message}</small>
              ) : null}

              <small className="text-gray-600">
                Your'll be able to initiate payment once it has been accepted by the recipient
                {company.requiredInvoiceApprovals > 1 ? " and has sufficient approvals" : ""}.
              </small>

              <DialogFooter>
                <div className="flex justify-end">
                  <MutationStatusButton
                    type="submit"
                    mutation={issuePaymentMutation}
                    successText="Payment submitted!"
                    loadingText="Saving..."
                  >
                    Issue payment
                  </MutationStatusButton>
                </div>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {tabs.length > 1 ? <Tabs links={tabs.map((tab) => ({ label: tab.label, route: `?tab=${tab.tab}` }))} /> : null}

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
            return <DetailsTab userId={id} setCancelModalOpen={setCancelModalOpen} />;
        }
      })()}
    </>
  );
}

const DetailsTab = ({
  userId,
  setCancelModalOpen,
}: {
  userId: string;
  setCancelModalOpen: (open: boolean) => void;
}) => {
  const company = useCurrentCompany();
  const router = useRouter();
  const [user] = trpc.users.get.useSuspenseQuery({ companyId: company.id, id: userId });
  const [contractor] = trpc.contractors.get.useSuspenseQuery({ companyId: company.id, userId });
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: contractor,
    disabled: !!contractor.endedAt,
  });
  const payRateInSubunits = form.watch("payRateInSubunits");
  const trpcUtils = trpc.useUtils();
  const updateContractor = trpc.contractors.update.useMutation({
    onSuccess: async (data) => {
      await trpcUtils.contractors.list.invalidate();
      await trpcUtils.documents.list.invalidate();
      await trpcUtils.contractors.get.invalidate({ userId });
      return router.push(data.documentId ? `/documents?sign=${data.documentId}` : "/people");
    },
  });
  const submit = form.handleSubmit((values) =>
    updateContractor.mutate({ companyId: company.id, id: contractor.id, ...values }),
  );
  const personalInfoForm = useForm({
    defaultValues: user,
    disabled: true,
  });

  return (
    <div className="grid gap-6">
      <Form {...form}>
        <form onSubmit={(e) => void submit(e)} className="grid gap-4">
          <h2 className="text-xl font-bold">Contract</h2>
          {contractor.endedAt ? (
            <Alert variant="destructive">
              <AlertTriangle />
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

          <FormFields />
          {payRateInSubunits && company.flags.includes("equity") ? (
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
          ) : null}
          {!contractor.endedAt && (
            <MutationStatusButton
              type="submit"
              mutation={updateContractor}
              loadingText="Saving..."
              className="justify-self-end"
            >
              Save changes
            </MutationStatusButton>
          )}
        </form>
      </Form>
      <Form {...personalInfoForm}>
        <div className="grid gap-4">
          <h2 className="text-xl font-bold">Personal info</h2>
          <FormField
            control={personalInfoForm.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <div className="flex items-center gap-2">
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <CopyButton variant="link" aria-label="Copy Email" copyText={field.value}>
                    <Copy className="size-4" />
                  </CopyButton>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={personalInfoForm.control}
            name="legalName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Legal name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid gap-3 md:grid-cols-2">
            <FormField
              control={personalInfoForm.control}
              name="preferredName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Preferred name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={personalInfoForm.control}
              name="businessName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Billing entity name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={personalInfoForm.control}
            name="address.streetAddress"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Residential address (street name, number, apt)</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid gap-3 md:grid-cols-2">
            <FormField
              control={personalInfoForm.control}
              name="address.city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City or town, state or province</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={personalInfoForm.control}
              name="address.zipCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Postal code</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={personalInfoForm.control}
            name="address.countryCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Country of residence</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid gap-3">
            <div>
              <label className="text-sm font-medium">Bank account</label>
              <div className="mt-1">
                {user.hasBankAccount ? (
                  <Status variant="success">Active</Status>
                ) : (
                  <Status variant="primary">Not added</Status>
                )}
              </div>
            </div>
          </div>
        </div>
      </Form>
    </div>
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
    <Placeholder icon={CircleCheck}>This investor does not hold any shares.</Placeholder>
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
    <Placeholder icon={CircleCheck}>This investor does not have any option grants.</Placeholder>
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
      columnHelper.accessor((row) => row.exerciseRequests.map((req) => req.equityGrant.name).join(", ") || "—", {
        header: "Option grant ID",
      }),
      columnHelper.accessor(
        (row) => row.exerciseRequests.flatMap((req) => req.shareHolding?.name ?? []).join(", ") || "—",
        { header: "Stock certificate ID" },
      ),
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
    <Placeholder icon={CircleCheck}>This investor has not exercised any options.</Placeholder>
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
    <Placeholder icon={CircleCheck}>This investor does not hold any convertible securities.</Placeholder>
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
    cell: (info) => <DividendStatusIndicator dividend={info.row.original} />,
  }),
];
function DividendsTab({ investorId }: { investorId: string }) {
  const company = useCurrentCompany();
  const [dividends] = trpc.dividends.list.useSuspenseQuery({ companyId: company.id, investorId });
  const table = useTable({ data: dividends, columns: dividendsColumns });

  return dividends.length > 0 ? (
    <DataTable table={table} />
  ) : (
    <Placeholder icon={CircleCheck}>This investor hasn't received any dividends yet.</Placeholder>
  );
}
