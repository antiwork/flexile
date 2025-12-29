"use client";

import { PaperClipIcon, TrashIcon } from "@heroicons/react/24/outline";
import { type DateValue, parseDate } from "@internationalized/date";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { List } from "immutable";
import { CircleAlert, Github, Plus, Upload } from "lucide-react";
import Link from "next/link";
import { redirect, useParams, useRouter, useSearchParams } from "next/navigation";
import React, { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import ComboBox from "@/components/ComboBox";
import { DashboardHeader } from "@/components/DashboardHeader";
import DatePicker from "@/components/DatePicker";
import { GitHubPRLineItem } from "@/components/GitHubPRLineItem";
import NumberInput from "@/components/NumberInput";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { trpc } from "@/trpc/client";
import { assert, assertDefined } from "@/utils/assert";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import { isGitHubPRUrl, parsePRState, type PRDetails } from "@/utils/github";
import { request } from "@/utils/request";
import {
  company_invoice_path,
  company_invoices_path,
  edit_company_invoice_path,
  new_company_invoice_path,
  oauth_url_github_path,
  pr_github_path,
} from "@/utils/routes";
import QuantityInput from "./QuantityInput";
import { LegacyAddress as Address, Totals, useCanSubmitInvoices } from ".";

// Schema for PR details returned from the API
const prDetailsSchema = z.object({
  url: z.string(),
  number: z.number(),
  title: z.string(),
  state: z.enum(["open", "merged", "closed"]),
  author: z.string(),
  repo: z.string(),
  bounty_cents: z.number().nullable(),
});

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
        // GitHub PR fields
        github_pr_url: z.string().nullable().optional(),
        github_pr_number: z.number().nullable().optional(),
        github_pr_title: z.string().nullable().optional(),
        github_pr_state: z.string().nullable().optional(),
        github_pr_author: z.string().nullable().optional(),
        github_pr_repo: z.string().nullable().optional(),
        github_pr_bounty_cents: z.number().nullable().optional(),
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

type InvoiceFormLineItem = Data["invoice"]["line_items"][number] & {
  errors?: string[] | null;
  // Local state for PR fetching
  prLoading?: boolean;
  prError?: string | null;
  prDetails?: PRDetails | null;
};
type InvoiceFormExpense = Data["invoice"]["expenses"][number] & { errors?: string[] | null; blob?: File | null };
type InvoiceFormDocument = Data["invoice"]["attachment"] & { errors?: string[] | null; blob?: File | null };

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
  const worker = user.roles.worker;
  assert(worker != null);

  const queryClient = useQueryClient();
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
  const actionColumnClass = "w-12";

  // GitHub PR integration state
  const [editingLineItemIndex, setEditingLineItemIndex] = useState<number | null>(null);
  const hasGitHubPRUrls = lineItems.some((item) => isGitHubPRUrl(item.description));
  const showGitHubConnectAlert = hasGitHubPRUrls && !user.githubUsername;

  // Fetch PR details when a GitHub URL is detected
  const fetchPRDetails = useCallback(
    async (url: string, rowIndex: number) => {
      if (!user.githubUsername) return;

      setLineItems((items) =>
        items.update(rowIndex, (item) => ({ ...assertDefined(item), prLoading: true, prError: null })),
      );

      try {
        const response = await request({
          method: "GET",
          url: `${pr_github_path()}?url=${encodeURIComponent(url)}`,
          accept: "json",
        });

        if (!response.ok) {
          const errorData = z.object({ error: z.string().optional() }).safeParse(await response.json());
          throw new Error(errorData.data?.error ?? "Failed to fetch PR details");
        }

        const data = z.object({ pr: prDetailsSchema }).parse(await response.json());

        setLineItems((items) =>
          items.update(rowIndex, (item) => ({
            ...assertDefined(item),
            prLoading: false,
            prDetails: data.pr,
            // Store PR data in the line item for persistence
            github_pr_url: data.pr.url,
            github_pr_number: data.pr.number,
            github_pr_title: data.pr.title,
            github_pr_state: data.pr.state,
            github_pr_author: data.pr.author,
            github_pr_repo: data.pr.repo,
            github_pr_bounty_cents: data.pr.bounty_cents,
          })),
        );
      } catch (err) {
        setLineItems((items) =>
          items.update(rowIndex, (item) => ({
            ...assertDefined(item),
            prLoading: false,
            prError: err instanceof Error ? err.message : "Failed to fetch PR details",
          })),
        );
      }
    },
    [user.githubUsername],
  );

  // Handle GitHub OAuth connection via popup
  const handleConnectGitHub = useCallback(async () => {
    const response = await request({
      method: "GET",
      url: oauth_url_github_path(),
      accept: "json",
    });

    if (!response.ok) return;

    const data = z.object({ url: z.string() }).parse(await response.json());

    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      data.url,
      "github-oauth",
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`,
    );

    const handleMessage = (event: MessageEvent<unknown>) => {
      const messageData = event.data;
      if (
        typeof messageData === "object" &&
        messageData !== null &&
        "type" in messageData &&
        messageData.type === "github-oauth-success"
      ) {
        void queryClient.invalidateQueries({ queryKey: ["currentUser"] });
        popup?.close();
        window.removeEventListener("message", handleMessage);
        toast.success("GitHub successfully connected.");

        // Fetch PR details for any existing GitHub URLs
        lineItems.forEach((item, index) => {
          if (isGitHubPRUrl(item.description) && !item.prDetails) {
            void fetchPRDetails(item.description, index);
          }
        });
      }
    };

    window.addEventListener("message", handleMessage);

    const pollTimer = setInterval(() => {
      if (popup?.closed) {
        clearInterval(pollTimer);
        window.removeEventListener("message", handleMessage);
      }
    }, 500);
  }, [queryClient, lineItems, fetchPRDetails]);

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
        // GitHub PR fields
        if (lineItem.github_pr_url) {
          formData.append("invoice_line_items[][github_pr_url]", lineItem.github_pr_url);
        }
        if (lineItem.github_pr_number != null) {
          formData.append("invoice_line_items[][github_pr_number]", lineItem.github_pr_number.toString());
        }
        if (lineItem.github_pr_title) {
          formData.append("invoice_line_items[][github_pr_title]", lineItem.github_pr_title);
        }
        if (lineItem.github_pr_state) {
          formData.append("invoice_line_items[][github_pr_state]", lineItem.github_pr_state);
        }
        if (lineItem.github_pr_author) {
          formData.append("invoice_line_items[][github_pr_author]", lineItem.github_pr_author);
        }
        if (lineItem.github_pr_repo) {
          formData.append("invoice_line_items[][github_pr_repo]", lineItem.github_pr_repo);
        }
        if (lineItem.github_pr_bounty_cents != null) {
          formData.append("invoice_line_items[][github_pr_bounty_cents]", lineItem.github_pr_bounty_cents.toString());
        }
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

      {payRateInSubunits && lineItems.some((lineItem) => lineItem.pay_rate_in_subunits > payRateInSubunits) ? (
        <Alert className="mx-4" variant="warning">
          <CircleAlert />
          <AlertDescription>
            This invoice includes rates above your default of {formatMoneyFromCents(payRateInSubunits)}/
            {data.user.project_based ? "project" : "hour"}. Please check before submitting.
          </AlertDescription>
        </Alert>
      ) : null}

      {showGitHubConnectAlert ? (
        <Alert className="mx-4" variant="warning">
          <Github className="size-4" />
          <AlertDescription className="flex flex-1 items-center justify-between gap-2">
            <span>Connect your GitHub account to verify your PRs</span>
            <Button variant="outline" size="small" onClick={() => void handleConnectGitHub()}>
              Connect GitHub
            </Button>
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
              {lineItems.toArray().map((item, rowIndex) => {
                const hasPRUrl = isGitHubPRUrl(item.description);
                const isEditing = editingLineItemIndex === rowIndex;
                const showPrettified = hasPRUrl && !isEditing && (item.prDetails ?? item.github_pr_url);

                // Build PR details from stored data or fetched data
                const prDetails: PRDetails | null =
                  item.prDetails ??
                  (item.github_pr_url
                    ? {
                        url: item.github_pr_url,
                        number: item.github_pr_number ?? 0,
                        title: item.github_pr_title ?? "",
                        state: parsePRState(item.github_pr_state),
                        author: item.github_pr_author ?? "",
                        repo: item.github_pr_repo ?? "",
                        bounty_cents: item.github_pr_bounty_cents ?? null,
                      }
                    : null);

                return (
                  <TableRow key={rowIndex}>
                    <TableCell>
                      {showPrettified ? (
                        <GitHubPRLineItem
                          pr={prDetails}
                          isLoading={item.prLoading ?? false}
                          error={item.prError ?? null}
                          onRetry={() => void fetchPRDetails(item.description, rowIndex)}
                          onClick={() => setEditingLineItemIndex(rowIndex)}
                          currentUserGitHubUsername={user.githubUsername}
                          hoverCardEnabled={!isEditing}
                        />
                      ) : (
                        <Input
                          value={item.description}
                          placeholder="Description or GitHub PR link..."
                          aria-invalid={item.errors?.includes("description")}
                          onChange={(e) => updateLineItem(rowIndex, { description: e.target.value })}
                          onFocus={() => setEditingLineItemIndex(rowIndex)}
                          onBlur={() => {
                            setEditingLineItemIndex(null);
                            // If this is a GitHub PR URL and user is connected, fetch details
                            if (isGitHubPRUrl(item.description) && user.githubUsername && !item.prDetails) {
                              void fetchPRDetails(item.description, rowIndex);
                            }
                          }}
                        />
                      )}
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
                        onChange={(value: number | null) =>
                          updateLineItem(rowIndex, { pay_rate_in_subunits: (value ?? 0) * 100 })
                        }
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
              })}
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
                          <Upload className="inline size-4" />
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
                          <Upload className="inline size-4" />
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
                        <Upload className="inline size-4" />
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
