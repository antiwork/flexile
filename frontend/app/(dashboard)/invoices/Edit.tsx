"use client";

import { PaperClipIcon, TrashIcon } from "@heroicons/react/24/outline";
import { type DateValue, parseDate } from "@internationalized/date";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { List } from "immutable";
import { CircleAlert, CircleDollarSign, Paperclip, Plus, RefreshCw } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { redirect, useParams, useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import ComboBox from "@/components/ComboBox";
import { DashboardHeader } from "@/components/DashboardHeader";
import DatePicker from "@/components/DatePicker";
import NumberInput from "@/components/NumberInput";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentCompany, useCurrentUser } from "@/global";
import githubMerge from "@/images/github-merge.svg";
import githubLogo from "@/images/github.svg";
import unverifiedAuthor from "@/images/unverified-author.svg";
import verifiedAuthor from "@/images/verified-author.svg";
import { FORMATTED_PR_REGEX, GITHUB_PR_REGEX } from "@/lib/regex";
import { type RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { assert, assertDefined } from "@/utils/assert";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import { request } from "@/utils/request";
import {
  company_invoice_path,
  company_invoices_path,
  edit_company_invoice_path,
  new_company_invoice_path,
  start_github_connection_url,
} from "@/utils/routes";
import { useIsMobile } from "@/utils/use-mobile";
import QuantityInput from "./QuantityInput";
import { LegacyAddress as Address, Totals, useCanSubmitInvoices } from ".";

const addressSchema = z.object({
  street_address: z.string(),
  city: z.string(),
  zip_code: z.string(),
  state: z.string().nullable(),
  country: z.string(),
  country_code: z.string(),
});

const dataSchema = z.object({
  user: z.object({
    legal_name: z.string(),
    business_entity: z.boolean(),
    billing_entity_name: z.string(),
    pay_rate_in_subunits: z.number().nullable(),
    project_based: z.boolean(),
    github_username: z.string().nullable(),
  }),
  company: z.object({
    id: z.string(),
    name: z.string(),
    address: addressSchema,
    expense_categories: z.array(z.object({ id: z.number(), name: z.string() })),
  }),
  invoice: z.object({
    id: z.string().optional(),
    bill_address: addressSchema,
    invoice_date: z.string(),
    description: z.string().nullable(),
    invoice_number: z.string(),
    notes: z.string().nullable(),
    status: z.enum(["received", "approved", "processing", "payment_pending", "paid", "rejected", "failed"]).nullable(),
    line_items: z.array(
      z.object({
        id: z.number().optional(),
        description: z.string(),
        quantity: z.string().nullable(),
        hourly: z.boolean(),
        pay_rate_in_subunits: z.number(),
      }),
    ),
    expenses: z.array(
      z.object({
        id: z.string().optional(),
        description: z.string(),
        category_id: z.number(),
        total_amount_in_cents: z.number(),
        attachment: z.object({ name: z.string(), url: z.string() }),
      }),
    ),
    attachment: z
      .object({
        name: z.string(),
        url: z.string(),
        signed_id: z.string().optional(),
      })
      .nullable()
      .default(null),
  }),
});
type Data = z.infer<typeof dataSchema>;

type InvoiceFormLineItem = Data["invoice"]["line_items"][number] & { errors?: string[] | null };
type InvoiceFormExpense = Data["invoice"]["expenses"][number] & { errors?: string[] | null; blob?: File | null };
type InvoiceFormDocument = Data["invoice"]["attachment"] & { errors?: string[] | null; blob?: File | null };

const actionColumnClass = "w-12";

const Edit = () => {
  const user = useCurrentUser();
  const company = useCurrentCompany();
  const { canSubmitInvoices } = useCanSubmitInvoices();
  if (!canSubmitInvoices) throw redirect("/invoices");
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [errorField, setErrorField] = useState<string | null>(null);
  const router = useRouter();
  const trpcUtils = trpc.useUtils();
  const { data: userConnection } = trpc.github.getUserConnection.useQuery();
  const worker = user.roles.worker;
  assert(worker != null);

  const [alertOpen, setAlertOpen] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");

  const { data, refetch } = useSuspenseQuery({
    queryKey: ["invoice", id],
    queryFn: async () => {
      const response = await request({
        url: id ? edit_company_invoice_path(company.id, id) : new_company_invoice_path(company.id),
        method: "GET",
        accept: "json",
        assertOk: true,
      });
      return dataSchema.parse(await response.json());
    },
  });
  const payRateInSubunits = data.user.pay_rate_in_subunits;

  const [invoiceNumber, setInvoiceNumber] = useState(data.invoice.invoice_number);
  const [issueDate, setIssueDate] = useState<DateValue>(() =>
    parseDate(searchParams.get("date") || data.invoice.invoice_date),
  );
  const invoiceYear = issueDate.year;
  const [notes, setNotes] = useState(data.invoice.notes ?? "");
  const [lineItems, setLineItems] = useState<List<InvoiceFormLineItem>>(() => {
    if (data.invoice.line_items.length) return List(data.invoice.line_items);

    return List([
      {
        description: "",
        quantity: (parseFloat(searchParams.get("quantity") ?? "") || (data.user.project_based ? 1 : 60)).toString(),
        hourly: searchParams.has("hourly") ? searchParams.get("hourly") === "true" : !data.user.project_based,
        pay_rate_in_subunits: parseInt(searchParams.get("rate") ?? "", 10) || (payRateInSubunits ?? 0),
      },
    ]);
  });
  const [showExpenses, setShowExpenses] = useState(false);
  const uploadExpenseRef = useRef<HTMLInputElement>(null);
  const [expenses, setExpenses] = useState(List<InvoiceFormExpense>(data.invoice.expenses));
  const uploadDocumentRef = useRef<HTMLInputElement>(null);
  const [document, setDocument] = useState<InvoiceFormDocument | null>(data.invoice.attachment);
  const showExpensesTable = showExpenses || expenses.size > 0;

  const validate = () => {
    setErrorField(null);
    if (invoiceNumber.length === 0) setErrorField("invoiceNumber");
    return (
      errorField === null &&
      lineItems.every((lineItem) => !lineItem.errors?.length) &&
      expenses.every((expense) => !expense.errors?.length) &&
      (!document || !document.errors?.length)
    );
  };

  const submit = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("invoice[invoice_number]", invoiceNumber);
      formData.append("invoice[invoice_date]", issueDate.toString());
      for (const lineItem of lineItems) {
        if (!lineItem.description || !lineItem.quantity) continue;
        if (lineItem.id) {
          formData.append("invoice_line_items[][id]", lineItem.id.toString());
        }
        formData.append("invoice_line_items[][description]", lineItem.description);
        formData.append("invoice_line_items[][quantity]", lineItem.quantity.toString());
        formData.append("invoice_line_items[][hourly]", lineItem.hourly.toString());
        formData.append("invoice_line_items[][pay_rate_in_subunits]", lineItem.pay_rate_in_subunits.toString());
      }
      for (const expense of expenses) {
        if (expense.id) {
          formData.append("invoice_expenses[][id]", expense.id.toString());
        }
        formData.append("invoice_expenses[][description]", expense.description);
        formData.append("invoice_expenses[][expense_category_id]", expense.category_id.toString());
        formData.append("invoice_expenses[][total_amount_in_cents]", expense.total_amount_in_cents.toString());
        if (expense.blob) {
          formData.append("invoice_expenses[][attachment]", expense.blob);
        }
      }

      if (notes.length) formData.append("invoice[notes]", notes);

      if (document) {
        if (document.blob) formData.append("invoice[attachment]", document.blob);
        else if (document.signed_id) formData.append("invoice[attachment]", document.signed_id);
      }

      await request({
        method: id ? "PATCH" : "POST",
        url: id ? company_invoice_path(company.id, id) : company_invoices_path(company.id),
        accept: "json",
        formData,
        assertOk: true,
      });
      await trpcUtils.invoices.list.invalidate({ companyId: company.id });
      await trpcUtils.invoices.get.invalidate({ companyId: company.id, id });
      await trpcUtils.documents.list.invalidate();
      if (id) {
        await refetch();
      }
      router.push("/invoices");
    },
  });

  const addLineItem = () =>
    setLineItems((lineItems) =>
      lineItems.push({
        description: "",
        quantity: (data.user.project_based ? 1 : 60).toString(),
        hourly: !data.user.project_based,
        pay_rate_in_subunits: payRateInSubunits ?? 0,
      }),
    );

  const createNewExpenseEntries = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    const oversizedFiles: string[] = [];
    const validFiles: File[] = [];

    Array.from(files).forEach((file) => {
      if (file.size > MAX_FILE_SIZE) {
        oversizedFiles.push(file.name);
      } else {
        validFiles.push(file);
      }
    });

    // Show alert if any files exceed size limit
    if (oversizedFiles.length > 0) {
      setAlertTitle("File Size Exceeded");
      if (oversizedFiles.length === 1) {
        setAlertMessage(`File "${oversizedFiles[0]}" exceeds the maximum limit of 10MB. Please select a smaller file.`);
      } else {
        setAlertMessage(
          `${oversizedFiles.length} files exceed the maximum limit of 10MB: ${oversizedFiles.join(", ")}. Please select smaller files.`,
        );
      }
      setAlertOpen(true);

      if (validFiles.length === 0) {
        e.target.value = "";
        return;
      }
    }

    const expenseCategory = assertDefined(data.company.expense_categories[0]);
    setShowExpenses(true);

    // Add each valid file as a separate expense
    validFiles.forEach((file) => {
      setExpenses((expenses) =>
        expenses.push({
          description: "",
          category_id: expenseCategory.id,
          total_amount_in_cents: 0,
          attachment: { name: file.name, url: URL.createObjectURL(file) },
          blob: file,
        }),
      );
    });
  };

  const handleDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file) return;

    const MAX_FILE_SIZE = 10 * 1024 * 1024;

    if (file.size > MAX_FILE_SIZE) {
      setAlertTitle("File Size Exceeded");
      setAlertMessage("File size exceeds the maximum limit of 10MB. Please select a smaller file.");
      setAlertOpen(true);
      e.target.value = "";
      return;
    }

    setDocument({
      name: file.name,
      url: URL.createObjectURL(file),
      blob: file,
      errors: null,
    });
  };

  const parseQuantity = (value: string | null | undefined) => {
    const parsed = value ? Number.parseFloat(value) : NaN;
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const lineItemTotal = (lineItem: InvoiceFormLineItem) =>
    Math.ceil((parseQuantity(lineItem.quantity) / (lineItem.hourly ? 60 : 1)) * lineItem.pay_rate_in_subunits);
  const totalExpensesAmountInCents = expenses.reduce((acc, expense) => acc + expense.total_amount_in_cents, 0);
  const totalServicesAmountInCents = lineItems.reduce((acc, lineItem) => acc + lineItemTotal(lineItem), 0);
  const [equityCalculation] = trpc.equityCalculations.calculate.useSuspenseQuery({
    companyId: company.id,
    servicesInCents: totalServicesAmountInCents,
    invoiceYear,
  });
  const updateLineItem = (index: number, update: Partial<InvoiceFormLineItem>) =>
    setLineItems((lineItems) =>
      lineItems.update(index, (lineItem) => {
        const updated = { ...assertDefined(lineItem), ...update };
        updated.errors = [];
        if (updated.description.length === 0) updated.errors.push("description");
        if (!updated.quantity || parseQuantity(updated.quantity) < 0.01) updated.errors.push("quantity");
        return updated;
      }),
    );
  const updateExpense = (index: number, update: Partial<InvoiceFormExpense>) =>
    setExpenses((expenses) =>
      expenses.update(index, (expense) => {
        const updated = { ...assertDefined(expense), ...update };
        updated.errors = [];
        if (updated.description.length === 0) updated.errors.push("description");
        if (!updated.category_id) updated.errors.push("category");
        if (!updated.total_amount_in_cents) updated.errors.push("amount");
        return updated;
      }),
    );

  const startGithubConnection = async (): Promise<void> => {
    const response = await request({
      method: "POST",
      accept: "json",
      url: start_github_connection_url(),
      jsonData: { redirect_url: window.location.href },
      assertOk: true,
    });

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const { url } = (await response.json()) as { url: string };

    window.location.href = url;
  };

  return (
    <>
      <AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{alertTitle}</AlertDialogTitle>
            <AlertDialogDescription>{alertMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setAlertOpen(false)}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DashboardHeader
        title={data.invoice.id ? "Edit invoice" : "New invoice"}
        headerActions={
          <>
            {data.invoice.id && data.invoice.status === "rejected" ? (
              <div className="inline-flex items-center">Action required</div>
            ) : (
              <Button variant="outline" asChild>
                <Link href="/invoices">Cancel</Link>
              </Button>
            )}
            <Button variant="primary" onClick={() => validate() && submit.mutate()} disabled={submit.isPending}>
              {submit.isPending ? "Sending..." : data.invoice.id ? "Resubmit" : "Send invoice"}
            </Button>
          </>
        }
      />

      {userConnection === null && lineItems.some((item) => GITHUB_PR_REGEX.test(item.description)) && (
        <Alert className="mx-4 mb-4 flex items-center justify-between border-sky-600 bg-blue-500/10 [&>svg]:translate-y-0">
          <CircleAlert />
          <AlertTitle className="flex-1 text-sm font-normal">
            You linked a Pull Request. Connect GitHub to verify your ownership and check for bounties.
          </AlertTitle>
          <Button
            variant="outline"
            onClick={() => {
              void startGithubConnection();
            }}
            className="h-9 cursor-pointer bg-white/80 text-black hover:bg-white hover:text-black dark:bg-white/70 dark:hover:bg-white"
          >
            <Image src={githubLogo} alt="Github" width={20} height={20} />
            Connect GitHub
          </Button>
        </Alert>
      )}

      {payRateInSubunits && lineItems.some((lineItem) => lineItem.pay_rate_in_subunits > payRateInSubunits) ? (
        <Alert className="mx-4" variant="warning">
          <CircleAlert />
          <AlertDescription>
            This invoice includes rates above your default of {formatMoneyFromCents(payRateInSubunits)}/
            {data.user.project_based ? "project" : "hour"}. Please check before submitting.
          </AlertDescription>
        </Alert>
      ) : null}

      <section>
        <div className="grid gap-4">
          <div className="mx-4 grid auto-cols-fr gap-3 md:grid-flow-col">
            <div>
              From
              <br />
              <strong>{data.user.billing_entity_name}</strong>
              <br />
              <Address address={data.invoice.bill_address} />
            </div>
            <div>
              To
              <br />
              <strong>{data.company.name}</strong>
              <br />
              <Address address={data.company.address} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="invoice-id">Invoice ID</Label>
              <Input
                id="invoice-id"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                aria-invalid={errorField === "invoiceNumber"}
              />
            </div>
            <div className="flex flex-col gap-2">
              <DatePicker
                value={issueDate}
                onChange={(date) => {
                  if (date) setIssueDate(date);
                }}
                aria-invalid={errorField === "issueDate"}
                label="Invoice date"
                granularity="day"
              />
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50%]">Line item</TableHead>
                <TableHead>Hours / Qty</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead className={actionColumnClass} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineItems.toArray().map((item, rowIndex) => (
                <LineItem
                  key={rowIndex}
                  rowIndex={rowIndex}
                  item={item}
                  updateLineItem={updateLineItem}
                  parseQuantity={parseQuantity}
                  lineItemTotal={lineItemTotal}
                  setLineItems={setLineItems}
                  invoiceOwnerGithubUsername={data.user.github_username}
                />
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={5}>
                  <div className="flex gap-3">
                    <Button variant="link" onClick={addLineItem}>
                      <Plus className="inline size-4" />
                      Add line item
                    </Button>
                    {data.company.expense_categories.length && !showExpensesTable ? (
                      <Button asChild variant="link">
                        <Label>
                          <CircleDollarSign className="inline size-4" />
                          Add expense
                          <input
                            ref={uploadExpenseRef}
                            type="file"
                            className="hidden"
                            accept="application/pdf, image/*"
                            multiple
                            onChange={createNewExpenseEntries}
                          />
                        </Label>
                      </Button>
                    ) : null}
                    {!document ? (
                      <Button asChild variant="link">
                        <Label>
                          <Paperclip className="inline size-4" />
                          Add document
                          <input
                            ref={uploadDocumentRef}
                            type="file"
                            className="hidden"
                            accept="application/pdf"
                            onChange={handleDocumentUpload}
                          />
                        </Label>
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
          {showExpensesTable ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Expense</TableHead>
                  <TableHead>Merchant</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead className={actionColumnClass} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.toArray().map((expense, rowIndex) => (
                  <TableRow key={rowIndex}>
                    <TableCell>
                      <a href={expense.attachment.url} download>
                        <PaperClipIcon className="inline size-4" />
                        {expense.attachment.name}
                      </a>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={expense.description}
                        aria-label="Merchant"
                        aria-invalid={expense.errors?.includes("description")}
                        onChange={(e) => updateExpense(rowIndex, { description: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <ComboBox
                        value={expense.category_id.toString()}
                        options={data.company.expense_categories.map((category) => ({
                          value: category.id.toString(),
                          label: category.name,
                        }))}
                        aria-label="Category"
                        aria-invalid={expense.errors?.includes("category")}
                        onChange={(value) => updateExpense(rowIndex, { category_id: Number(value) })}
                      />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <NumberInput
                        value={expense.total_amount_in_cents / 100}
                        placeholder="0"
                        onChange={(value: number | null) =>
                          updateExpense(rowIndex, { total_amount_in_cents: (value ?? 0) * 100 })
                        }
                        aria-label="Amount"
                        aria-invalid={expense.errors?.includes("amount") ?? false}
                        prefix="$"
                        decimal
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="link"
                        aria-label="Remove"
                        onClick={() => setExpenses((expenses) => expenses.delete(rowIndex))}
                      >
                        <TrashIcon className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={5}>
                    <Button asChild variant="link">
                      <Label>
                        <CircleDollarSign className="inline size-4" />
                        Add expense
                        <input
                          ref={uploadExpenseRef}
                          type="file"
                          className="hidden"
                          accept="application/pdf, image/*"
                          multiple
                          onChange={createNewExpenseEntries}
                        />
                      </Label>
                    </Button>
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          ) : null}
          {document ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead className={actionColumnClass} />
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>
                    <a href={document.url} download>
                      <PaperClipIcon className="inline size-4" /> {document.name}
                    </a>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="link" aria-label="Remove" onClick={() => setDocument(null)}>
                      <TrashIcon className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          ) : null}

          <footer className="mx-4 flex flex-col gap-3 lg:flex-row lg:justify-between">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter notes about your invoice (optional)"
              className="w-full whitespace-pre-wrap lg:w-96"
            />
            <Totals
              servicesTotal={totalServicesAmountInCents}
              expensesTotal={totalExpensesAmountInCents}
              equityAmountInCents={equityCalculation.equityCents}
              equityPercentage={equityCalculation.equityPercentage}
              isOwnUser
            />
          </footer>
        </div>
      </section>
    </>
  );
};

export default Edit;

interface LineItemProps {
  rowIndex: number;
  item: InvoiceFormLineItem;
  updateLineItem: (index: number, update: Partial<InvoiceFormLineItem>) => void;
  setLineItems: React.Dispatch<React.SetStateAction<List<InvoiceFormLineItem>>>;
  parseQuantity: (value: string | null | undefined) => number;
  lineItemTotal: (lineItem: InvoiceFormLineItem) => number;
  invoiceOwnerGithubUsername: string | null;
}

const LineItem = ({
  rowIndex,
  item,
  updateLineItem,
  setLineItems,
  parseQuantity,
  lineItemTotal,
  invoiceOwnerGithubUsername,
}: LineItemProps) => {
  const company = useCurrentCompany();
  const [isEditing, setIsEditing] = useState(false);
  const [debouncedDescription, setDebouncedDescription] = useState(item.description);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedDescription(item.description);
    }, 1000);

    return () => clearTimeout(handler);
  }, [item.description]);

  const prMatch = debouncedDescription.match(GITHUB_PR_REGEX);
  const formattedMatch = debouncedDescription.match(FORMATTED_PR_REGEX);

  const prUrl = prMatch
    ? prMatch[0]
    : formattedMatch
      ? `https://github.com/${formattedMatch[1]}/pull/${formattedMatch[2]}`
      : null;

  if (!prUrl) return;

  const {
    data: prResult,
    isLoading: isFetchingPR,
    isError,
    refetch,
  } = trpc.github.fetchPullRequest.useQuery(
    { url: prUrl, companyId: company.id, targetUsername: invoiceOwnerGithubUsername },
    { enabled: !!prUrl, retry: false },
  );

  useEffect(() => {
    if (prResult?.pr.bounty_cents) {
      if (
        item.pay_rate_in_subunits !== prResult.pr.bounty_cents ||
        item.description !== `[${prResult.pr.repository} #${prResult.pr.number}] ${prResult.pr.title}`
      ) {
        updateLineItem(rowIndex, {
          pay_rate_in_subunits: prResult.pr.bounty_cents,
          hourly: false,
          quantity: "1",
          description: `[${prResult.pr.repository} #${prResult.pr.number}] ${prResult.pr.title}`,
        });
        toast.success(`Applied $${prResult.pr.bounty_cents / 100} bounty`);
        setIsEditing(false);
      }
    }
  }, [prResult, updateLineItem, rowIndex, item.pay_rate_in_subunits, item.description]);

  return (
    <TableRow>
      <TableCell>
        <div className="relative">
          {(!prUrl && !prResult) || isError || isEditing ? (
            <div className="relative">
              <Input
                value={item.description}
                placeholder="Description or GitHub PR link..."
                type="text"
                autoFocus={isEditing}
                aria-invalid={item.errors?.includes("description")}
                onBlur={() => {
                  if (
                    !isError &&
                    (item.description.match(GITHUB_PR_REGEX) || item.description.match(FORMATTED_PR_REGEX))
                  ) {
                    setIsEditing(false);
                  }
                }}
                onChange={(e) => updateLineItem(rowIndex, { description: e.target.value })}
                className={`peer ${isError ? "pr-20" : "pr-9"}`}
              />
              <div className="absolute inset-y-0 right-0 flex items-center gap-1.5 pr-1.5">
                {isFetchingPR ||
                (item.description !== debouncedDescription &&
                  (item.description.match(GITHUB_PR_REGEX) || item.description.match(FORMATTED_PR_REGEX))) ? (
                  <div className="text-muted-foreground">
                    <RefreshCw className={`size-4 animate-spin ${isError ? "hidden" : "block"}`} />
                  </div>
                ) : null}
                {isError ? (
                  <Button
                    variant="ghost"
                    size="small"
                    className="group text-muted-foreground hover:bg-accent/50 hover:text-foreground flex h-7 items-center gap-1.5 px-2 text-xs font-bold"
                    onClick={(e) => {
                      e.stopPropagation();
                      void refetch();
                    }}
                  >
                    <RefreshCw className="size-3.5 animate-spin" />
                    <span className="group-hover:underline group-hover:underline-offset-2">Retry</span>
                  </Button>
                ) : null}
              </div>
            </div>
          ) : (
            <ResponsivePRCard
              prUrl={prUrl}
              prResult={prResult}
              isFetchingPR={isFetchingPR}
              setIsEditing={setIsEditing}
            />
          )}
        </div>
      </TableCell>

      <TableCell>
        <QuantityInput
          value={item.quantity ? { quantity: parseQuantity(item.quantity), hourly: item.hourly } : null}
          aria-label="Hours / Qty"
          aria-invalid={item.errors?.includes("quantity")}
          onChange={(value) =>
            updateLineItem(rowIndex, {
              quantity: value?.quantity.toString() ?? null,
              hourly: value?.hourly ?? false,
            })
          }
        />
      </TableCell>
      <TableCell>
        <NumberInput
          value={item.pay_rate_in_subunits / 100}
          onChange={(value: number | null) => updateLineItem(rowIndex, { pay_rate_in_subunits: (value ?? 0) * 100 })}
          aria-label="Rate"
          placeholder="0"
          prefix="$"
          decimal
        />
      </TableCell>
      <TableCell>{formatMoneyFromCents(lineItemTotal(item))}</TableCell>
      <TableCell className={actionColumnClass}>
        <Button
          variant="link"
          aria-label="Remove"
          onClick={() => setLineItems((lineItems) => lineItems.delete(rowIndex))}
        >
          <TrashIcon className="size-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
};
interface ResponsivePRCardProps {
  prUrl: string | null;
  prResult: RouterOutput["github"]["fetchPullRequest"] | undefined | null;
  isFetchingPR: boolean;
  setIsEditing: (isEditing: boolean) => void;
}

const ResponsivePRCard = ({ prUrl, prResult, isFetchingPR, setIsEditing }: ResponsivePRCardProps) => {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);

  const TriggerContent = (
    <div className="border-input hover:bg-accent focus-within:ring-ring flex h-10 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm focus-within:ring-2">
      <Image src={githubMerge} alt="GitHub PR" width={16} height={16} />
      {prResult ? (
        <>
          <span className="bg-secondary truncate rounded-sm px-2 py-0.5 text-xs font-medium">
            {prResult.pr.repository}
          </span>
          <span className="max-w-[200px] truncate font-normal">{prResult.pr.title}</span>
          <span className="text-muted-foreground font-light">#{prResult.pr.number}</span>
          {prResult.pr.bounty_cents ? (
            <Badge variant="secondary" className="border">
              ${prResult.pr.bounty_cents / 100}
            </Badge>
          ) : null}
        </>
      ) : (
        <div className="flex flex-1 items-center gap-2 overflow-hidden">
          <span className="text-muted-foreground truncate opacity-70">{prUrl}</span>
        </div>
      )}
      <div className="ml-auto flex items-center gap-1">
        {isFetchingPR ? (
          <Button
            variant="ghost"
            size="small"
            className="h-7 w-7 p-0 opacity-50 hover:opacity-100"
            title="Fetching PR..."
          >
            <RefreshCw className="size-3.5 animate-spin" />
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="small"
          className="h-7 px-2 text-xs font-medium opacity-50 hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            setIsEditing(true);
          }}
        >
          Edit
        </Button>
      </div>
    </div>
  );

  const DetailsContent = prResult && (
    <div className="flex flex-col">
      <div className="bg-muted/10 flex items-center px-4 py-2">
        <div className="flex items-center gap-1.5 overflow-hidden text-sm font-medium">
          <span className="text-foreground shrink-0">{prResult.pr.repository}</span>
          <span className="text-muted-foreground">⋅</span>
          <span className="text-muted-foreground truncate">{prResult.pr.author}</span>
        </div>
      </div>

      <Separator className="my-0" />

      <div className="px-4 py-4">
        <a
          href={prResult.pr.html_url}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-baseline gap-1.5"
        >
          <h4 className="text-[15px] leading-snug font-semibold decoration-blue-500/10 underline-offset-4 group-hover:text-blue-600 group-hover:underline">
            {prResult.pr.title}
          </h4>
          <span className="text-muted-foreground text-xs font-medium">#{prResult.pr.number}</span>
        </a>

        <div className="mt-4 flex items-center justify-between">
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-white ${
              prResult.pr.merged ? "bg-purple-600" : prResult.pr.state === "open" ? "bg-green-600" : "bg-gray-500"
            }`}
          >
            {prResult.pr.merged ? "Merged" : prResult.pr.state === "open" ? "Open" : "Closed"}
          </span>
        </div>
      </div>

      <Separator className="my-0" />

      <div className="bg-muted/50 flex flex-col gap-0">
        <div className="flex items-center gap-3 px-4 py-2">
          {prResult.pr.verified_author ? (
            <div className="text-muted-foreground flex items-center gap-2.5 text-[12px] font-medium">
              <Image src={verifiedAuthor} alt="" width={16} height={16} className="shrink-0" />
              <span>
                <span className="font-bold text-green-600">Verified author</span> of this pull request.
              </span>
            </div>
          ) : (
            <div className="text-muted-foreground flex items-center gap-2.5 text-[12px] font-medium">
              <Image src={unverifiedAuthor} alt="" width={16} height={16} className="shrink-0" />
              <span>
                <span className="font-bold">Unverified author</span> of this pull request.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>{TriggerContent}</PopoverTrigger>
        <PopoverContent
          align="start"
          className="border-border/50 w-[calc(100vw-32px)] max-w-[340px] overflow-hidden p-0 shadow-2xl"
        >
          {DetailsContent}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <HoverCard openDelay={100}>
      <HoverCardTrigger asChild>{TriggerContent}</HoverCardTrigger>
      {prResult ? (
        <HoverCardContent align="start" className="border-border/50 w-[340px] overflow-hidden p-0 shadow-2xl">
          {DetailsContent}
        </HoverCardContent>
      ) : null}
    </HoverCard>
  );
};
