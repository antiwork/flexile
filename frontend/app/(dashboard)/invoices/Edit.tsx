"use client";

import { ArrowUpTrayIcon, PlusIcon } from "@heroicons/react/16/solid";
import { PaperAirplaneIcon, PaperClipIcon, TrashIcon } from "@heroicons/react/24/outline";
import { type DateValue, parseDate } from "@internationalized/date";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { List } from "immutable";
import { CircleAlert } from "lucide-react";
import Link from "next/link";
import { redirect, useParams, useRouter, useSearchParams } from "next/navigation";
import React, { useRef, useState } from "react";
import { z } from "zod";
import ComboBox from "@/components/ComboBox";
import { DashboardHeader } from "@/components/DashboardHeader";
import DatePicker from "@/components/DatePicker";
import { linkClasses } from "@/components/Link";
import NumberInput from "@/components/NumberInput";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { trpc } from "@/trpc/client";
import { assert, assertDefined } from "@/utils/assert";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import { request } from "@/utils/request";
import {
  company_invoice_path,
  company_invoices_path,
  edit_company_invoice_path,
  new_company_invoice_path,
} from "@/utils/routes";
import QuantityInput from "./QuantityInput";
import { LegacyAddress as Address, useCanSubmitInvoices } from ".";

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
  }),
});

type Data = z.infer<typeof dataSchema>;
type InvoiceFormLineItem = Data["invoice"]["line_items"][number] & { errors?: string[] | null };
type InvoiceFormExpense = Data["invoice"]["expenses"][number] & { errors?: string[] | null; blob?: File | null };

interface EditProps {
  onClose?: () => void;
  invoiceId?: string;
  isModal?: boolean;
}

const Edit: React.FC<EditProps> = ({ onClose, invoiceId: propInvoiceId, isModal = false }) => {
  const user = useCurrentUser();
  const company = useCurrentCompany();
  const { canSubmitInvoices } = useCanSubmitInvoices();

  const params = useParams<{ id: string }>();
  const id = propInvoiceId || params?.id;

  const searchParams = useSearchParams();
  const [errorField, setErrorField] = useState<string | null>(null);
  const router = useRouter();
  const trpcUtils = trpc.useUtils();
  const worker = user.roles.worker;

  if (!canSubmitInvoices && !isModal) throw redirect("/invoices");
  if (!canSubmitInvoices && isModal) {
    onClose?.();
    return null;
  }

  assert(worker != null);

  const { data } = useSuspenseQuery({
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
  const showExpensesTable = showExpenses || expenses.size > 0;

  const validate = () => {
    setErrorField(null);
    if (invoiceNumber.length === 0) setErrorField("invoiceNumber");
    return (
      errorField === null &&
      lineItems.every((lineItem) => !lineItem.errors?.length) &&
      expenses.every((expense) => !expense.errors?.length)
    );
  };

  const submit = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("invoice[invoice_number]", invoiceNumber);
      formData.append("invoice[invoice_date]", issueDate.toString());
      for (const lineItem of lineItems) {
        if (!lineItem.description || !lineItem.quantity) continue;
        if (lineItem.id) formData.append("invoice_line_items[][id]", lineItem.id.toString());
        formData.append("invoice_line_items[][description]", lineItem.description);
        formData.append("invoice_line_items[][quantity]", lineItem.quantity.toString());
        formData.append("invoice_line_items[][hourly]", lineItem.hourly.toString());
        formData.append("invoice_line_items[][pay_rate_in_subunits]", lineItem.pay_rate_in_subunits.toString());
      }
      for (const expense of expenses) {
        if (expense.id) formData.append("invoice_expenses[][id]", expense.id.toString());
        formData.append("invoice_expenses[][description]", expense.description);
        formData.append("invoice_expenses[][expense_category_id]", expense.category_id.toString());
        formData.append("invoice_expenses[][total_amount_in_cents]", expense.total_amount_in_cents.toString());
        if (expense.blob) formData.append("invoice_expenses[][attachment]", expense.blob);
      }
      if (notes.length) formData.append("invoice[notes]", notes);

      await request({
        method: id ? "PATCH" : "POST",
        url: id ? company_invoice_path(company.id, id) : company_invoices_path(company.id),
        accept: "json",
        formData,
        assertOk: true,
      });
      await trpcUtils.invoices.list.invalidate({ companyId: company.id });
      await trpcUtils.documents.list.invalidate();

      if (isModal && onClose) onClose();
      else router.push("/invoices");
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
    if (!files) return;
    const expenseCategory = assertDefined(data.company.expense_categories[0]);
    setShowExpenses(true);
    setExpenses((expenses) =>
      expenses.push(
        ...[...files].map((file) => ({
          description: "",
          category_id: expenseCategory.id,
          total_amount_in_cents: 0,
          attachment: { name: file.name, url: URL.createObjectURL(file) },
          blob: file,
        })),
      ),
    );
  };

  const parseQuantity = (value: string | null | undefined) => {
    const parsed = value ? Number.parseFloat(value) : NaN;
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const lineItemTotal = (lineItem: InvoiceFormLineItem) =>
    Math.ceil((parseQuantity(lineItem.quantity) / (lineItem.hourly ? 60 : 1)) * lineItem.pay_rate_in_subunits);

  const totalExpensesAmountInCents = expenses.reduce((acc, expense) => acc + expense.total_amount_in_cents, 0);
  const totalServicesAmountInCents = lineItems.reduce((acc, lineItem) => acc + lineItemTotal(lineItem), 0);
  const totalInvoiceAmountInCents = totalServicesAmountInCents + totalExpensesAmountInCents;

  const { data: equityCalculation } = trpc.equityCalculations.calculate.useQuery({
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

  const handleCancel = () => {
    if (isModal && onClose) onClose();
    else router.push("/invoices");
  };

  return (
    <div
      className={isModal ? "fixed inset-0 z-50 flex items-start justify-center bg-gray-900 p-4 sm:items-center" : ""}
    >
      <div
        className={isModal ? "max-h-[90vh] w-full max-w-5xl space-y-6 rounded-2xl bg-white p-6 shadow-lg" : "space-y-6"}
      >
        {/* Header */}
        {!isModal && (
          <DashboardHeader
            title={data.invoice.id ? "Edit invoice" : "New invoice"}
            headerActions={
              <>
                {data.invoice.id && data.invoice.status === "rejected" ? (
                  <div className="inline-flex items-center">Action required</div>
                ) : (
                  <Button size="small" variant="outline" onClick={handleCancel}>
                    Cancel
                  </Button>
                )}
                <Button
                  size="small"
                  variant="primary"
                  onClick={() => validate() && submit.mutate()}
                  disabled={submit.isPending}
                >
                  <PaperAirplaneIcon className="size-4" />
                  {submit.isPending ? "Sending..." : data.invoice.id ? "Re-submit invoice" : "Send invoice"}
                </Button>
              </>
            }
          />
        )}

        {isModal ? (
          <div className="flex justify-end gap-2 border-b pb-2">
            <Button size="small" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button
              size="small"
              variant="primary"
              onClick={() => validate() && submit.mutate()}
              disabled={submit.isPending}
            >
              <PaperAirplaneIcon className="size-4" />
              {submit.isPending ? "Sending..." : data.invoice.id ? "Re-submit invoice" : "Send invoice"}
            </Button>
          </div>
        ) : null}

        {/* ALERT */}
        {payRateInSubunits && lineItems.some((li) => li.pay_rate_in_subunits > payRateInSubunits) ? (
          <Alert className={isModal ? "" : "mx-4"} variant="warning">
            <CircleAlert />
            <AlertDescription>
              This invoice includes rates above your default of {formatMoneyFromCents(payRateInSubunits)}/
              {data.user.project_based ? "project" : "hour"}. Please check before submitting.
            </AlertDescription>
          </Alert>
        ) : null}

        {/* INVOICE FORM */}
        <section>
          <div className="grid gap-4">
            <div className={`grid auto-cols-fr gap-3 md:grid-flow-col ${!isModal ? "mx-4" : ""}`}>
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
                  onChange={(date) => date && setIssueDate(date)}
                  aria-invalid={errorField === "issueDate"}
                  label="Invoice date"
                  granularity="day"
                />
              </div>
            </div>

            {/* LINE ITEMS TABLE */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50%]">Line item</TableHead>
                  <TableHead>Hours / Qty</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineItems.toArray().map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Input
                        value={item.description}
                        placeholder="Description"
                        aria-invalid={item.errors?.includes("description")}
                        onChange={(e) => updateLineItem(idx, { description: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <QuantityInput
                        value={item.quantity ? { quantity: parseQuantity(item.quantity), hourly: item.hourly } : null}
                        aria-label="Hours / Qty"
                        aria-invalid={item.errors?.includes("quantity")}
                        onChange={(v) =>
                          updateLineItem(idx, { quantity: v?.quantity.toString() ?? null, hourly: v?.hourly ?? false })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <NumberInput
                        value={item.pay_rate_in_subunits / 100}
                        onChange={(v) => updateLineItem(idx, { pay_rate_in_subunits: (v ?? 0) * 100 })}
                        aria-label="Rate"
                        prefix="$"
                        decimal
                      />
                    </TableCell>
                    <TableCell>{formatMoneyFromCents(lineItemTotal(item))}</TableCell>
                    <TableCell>
                      <Button variant="link" aria-label="Remove" onClick={() => setLineItems((li) => li.delete(idx))}>
                        <TrashIcon className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={5}>
                    <div className="flex gap-3">
                      <Button variant="link" onClick={addLineItem}>
                        <PlusIcon className="inline size-4" />
                        Add line item
                      </Button>
                      {data.company.expense_categories.length && !showExpensesTable ? (
                        <Button variant="link" onClick={() => uploadExpenseRef.current?.click()}>
                          <ArrowUpTrayIcon className="inline size-4" />
                          Add expense
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>

            {/* EXPENSES UPLOAD */}
            {data.company.expense_categories.length ? (
              <input
                ref={uploadExpenseRef}
                type="file"
                className="hidden"
                accept="application/pdf, image/*"
                multiple
                onChange={createNewExpenseEntries}
              />
            ) : null}

            {/* EXPENSES TABLE */}
            {showExpensesTable ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Expense</TableHead>
                    <TableHead>Merchant</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.toArray().map((exp, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <a href={exp.attachment.url} download>
                          <PaperClipIcon className="inline size-4" />
                          {exp.attachment.name}
                        </a>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={exp.description}
                          aria-label="Merchant"
                          aria-invalid={exp.errors?.includes("description")}
                          onChange={(e) => updateExpense(idx, { description: e.target.value })}
                        />
                      </TableCell>
                      <TableCell>
                        <ComboBox
                          value={exp.category_id.toString()}
                          options={data.company.expense_categories.map((cat) => ({
                            value: cat.id.toString(),
                            label: cat.name,
                          }))}
                          aria-label="Category"
                          aria-invalid={exp.errors?.includes("category")}
                          onChange={(v) => updateExpense(idx, { category_id: Number(v) })}
                        />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <NumberInput
                          value={exp.total_amount_in_cents / 100}
                          placeholder="0"
                          onChange={(v) => updateExpense(idx, { total_amount_in_cents: (v ?? 0) * 100 })}
                          aria-invalid={exp.errors?.includes("amount") ?? false}
                          prefix="$"
                          decimal
                        />
                      </TableCell>
                      <TableCell>
                        <Button variant="link" aria-label="Remove" onClick={() => setExpenses((ex) => ex.delete(idx))}>
                          <TrashIcon className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Button variant="link" onClick={() => uploadExpenseRef.current?.click()}>
                        <PlusIcon className="inline size-4" />
                        Add expense
                      </Button>
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            ) : null}

            {/* FOOTER */}
            <footer className={`flex flex-col gap-3 lg:flex-row lg:justify-between ${!isModal ? "mx-4" : ""}`}>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter notes about your invoice (optional)"
                className="w-full lg:w-96"
              />
              <div className="flex flex-col gap-2 md:self-start lg:items-end">
                {showExpensesTable || company.equityEnabled ? (
                  <div className="flex flex-col items-end">
                    <span>Total services</span>
                    <span className="numeric text-xl">{formatMoneyFromCents(totalServicesAmountInCents)}</span>
                  </div>
                ) : null}
                {showExpensesTable ? (
                  <div className="flex flex-col items-end">
                    <span>Total expenses</span>
                    <span className="numeric text-xl">{formatMoneyFromCents(totalExpensesAmountInCents)}</span>
                  </div>
                ) : null}
                {company.equityEnabled && equityCalculation ? (
                  <>
                    <div className="flex flex-col items-end">
                      <span>
                        <Link href="/settings/payouts" className={linkClasses}>
                          Swapped for equity (not paid in cash)
                        </Link>
                      </span>
                      <span className="numeric text-xl">{formatMoneyFromCents(equityCalculation.equityCents)}</span>
                    </div>
                    <Separator />
                    <div className="flex flex-col items-end">
                      <span>Net amount in cash</span>
                      <span className="numeric text-3xl">
                        {formatMoneyFromCents(totalInvoiceAmountInCents - equityCalculation.equityCents)}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col gap-1 lg:items-end">
                    <span>Total</span>
                    <span className="numeric text-3xl">{formatMoneyFromCents(totalInvoiceAmountInCents)}</span>
                  </div>
                )}
              </div>
            </footer>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Edit;
