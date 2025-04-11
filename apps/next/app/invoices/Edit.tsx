"use client";

import { ArrowUpTrayIcon, PlusIcon } from "@heroicons/react/16/solid";
import { PaperAirplaneIcon, PaperClipIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { formatISO } from "date-fns";
import { List } from "immutable";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { z } from "zod";
import EquityPercentageLockModal from "@/app/invoices/EquityPercentageLockModal";
import Button from "@/components/Button";
import { Card, CardRow } from "@/components/Card";
import DecimalInput from "@/components/DecimalInput";
import DurationInput from "@/components/DurationInput";
import Input from "@/components/Input";
import MainLayout from "@/components/layouts/Main";
import Select from "@/components/Select";
import Table, { createColumnHelper, useTable } from "@/components/Table";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentCompany } from "@/global";
import { trpc } from "@/trpc/client";
import { assertDefined } from "@/utils/assert";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import { request } from "@/utils/request";
import {
  company_invoice_path,
  company_invoices_path,
  edit_company_invoice_path,
  new_company_invoice_path,
} from "@/utils/routes";
import { LegacyAddress as Address } from ".";

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
    pay_rate_in_subunits: z.number(),
    project_based: z.boolean(),
  }),
  company: z.object({
    id: z.string(),
    name: z.string(),
    address: addressSchema,
    expenses: z.object({ enabled: z.boolean(), categories: z.array(z.object({ id: z.number(), name: z.string() })) }),
  }),
  invoice: z.object({
    id: z.string().optional(),
    bill_address: addressSchema,
    invoice_date: z.string(),
    description: z.string().nullable(),
    total_minutes: z.number().nullable(),
    invoice_number: z.string(),
    notes: z.string().nullable(),
    status: z.enum(["received", "approved", "processing", "payment_pending", "paid", "rejected", "failed"]).nullable(),
    max_minutes: z.number(),
    line_items: z.array(
      z.object({
        id: z.number().optional(),
        description: z.string(),
        minutes: z.number().nullable(),
        pay_rate_in_subunits: z.number(),
        total_amount_cents: z.number(),
      }),
    ),
    equity_amount_in_cents: z.number(),
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
  equity_allocation: z.object({ percentage: z.number().nullable(), is_locked: z.boolean().nullable() }).optional(),
});
type Data = z.infer<typeof dataSchema>;

type InvoiceFormLineItem = Data["invoice"]["line_items"][number] & { errors?: string[] | null };
type InvoiceFormExpense = Data["invoice"]["expenses"][number] & { errors?: string[] | null; blob?: File | null };

const Edit = () => {
  const company = useCurrentCompany();
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [showExpenses, setShowExpenses] = useState(!!searchParams.get("expenses"));
  const [errorField, setErrorField] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const uploadExpenseRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const trpcUtils = trpc.useUtils();

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

  const [invoiceNumber, setInvoiceNumber] = useState(data.invoice.invoice_number);
  const [issueDate, setIssueDate] = useState(
    searchParams.get("date") || formatISO(data.invoice.invoice_date, { representation: "date" }),
  );
  const invoiceYear = new Date(issueDate).getFullYear() || new Date().getFullYear();
  const [notes, setNotes] = useState(data.invoice.notes ?? "");
  const [lineItems, setLineItems] = useState<List<InvoiceFormLineItem>>(() => {
    if (data.invoice.line_items.length) return List(data.invoice.line_items);

    const quickInvoiceDuration = parseInt(searchParams.get("duration") ?? "", 10) || 0;
    const quickInvoiceAmountUsd =
      parseInt(searchParams.get("amount") ?? "", 10) || data.user.pay_rate_in_subunits / 100;

    return List([
      {
        description: "",
        minutes: quickInvoiceDuration,
        pay_rate_in_subunits: data.user.project_based ? 0 : data.user.pay_rate_in_subunits,
        total_amount_cents: data.user.project_based
          ? quickInvoiceAmountUsd * 100
          : Math.ceil(data.user.pay_rate_in_subunits * (quickInvoiceDuration / 60)),
      },
    ]);
  });
  const [expenses, setExpenses] = useState(List<InvoiceFormExpense>(data.invoice.expenses));

  const validate = () => {
    setErrorField(null);
    if (invoiceNumber.length === 0) setErrorField("invoiceNumber");
    return (
      errorField === null &&
      lineItems.every((lineItem) => !lineItem.errors?.length) &&
      expenses.every((expense) => !expense.errors?.length)
    );
  };

  const showModal = () => {
    if (!validate()) return;

    if (equityCalculation.isEquityAllocationLocked === false && equityCalculation.selectedPercentage != null) {
      setModalOpen(true);
    } else {
      submit.mutate();
    }
  };

  const submit = useMutation({
    mutationFn: async () => {
      setModalOpen(false);

      const formData = new FormData();
      formData.append("invoice[invoice_number]", invoiceNumber);
      formData.append("invoice[invoice_date]", issueDate);
      for (const lineItem of lineItems) {
        if (lineItem.id) {
          formData.append("invoice_line_items[][id]", lineItem.id.toString());
        }
        formData.append("invoice_line_items[][description]", lineItem.description);
        if (data.user.project_based) {
          formData.append("invoice_line_items[][total_amount_cents]", lineItem.total_amount_cents.toString());
        } else if (lineItem.minutes) {
          formData.append("invoice_line_items[][minutes]", lineItem.minutes.toString());
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

      await request({
        method: id ? "PATCH" : "POST",
        url: id ? company_invoice_path(company.id, id) : company_invoices_path(company.id),
        accept: "json",
        formData,
        assertOk: true,
      });
      await trpcUtils.invoices.list.invalidate({ companyId: company.id });
      router.push("/invoices");
    },
  });

  const addLineItem = () =>
    setLineItems((lineItems) =>
      lineItems.push({
        description: "",
        minutes: 0,
        pay_rate_in_subunits: data.user.project_based ? 0 : data.user.pay_rate_in_subunits,
        total_amount_cents: 0,
      }),
    );

  const createNewExpenseEntries = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const expenseCategory = assertDefined(data.company.expenses.categories[0]);
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

  const totalExpensesAmountInCents = expenses.reduce((acc, expense) => acc + expense.total_amount_in_cents, 0);
  const totalServicesAmountInCents = lineItems.reduce((acc, lineItem) => acc + lineItem.total_amount_cents, 0);
  const totalInvoiceAmountInCents = totalServicesAmountInCents + totalExpensesAmountInCents;
  const [equityCalculation] = trpc.equityCalculations.calculate.useSuspenseQuery({
    companyId: company.id,
    servicesInCents: totalServicesAmountInCents,
    invoiceYear,
  });
  const canManageExpenses = showExpenses || expenses.size > 0;
  const updateLineItem = (index: number, update: Partial<InvoiceFormLineItem>) =>
    setLineItems((lineItems) =>
      lineItems.update(index, (lineItem) => {
        const updated = { ...assertDefined(lineItem), ...update };
        updated.errors = [];
        if (updated.description.length === 0) updated.errors.push("description");
        if (
          !data.user.project_based &&
          (!updated.minutes || updated.minutes <= 0 || updated.minutes > data.invoice.max_minutes)
        ) {
          updated.errors.push("minutes");
        }
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

  const invoiceColumnHelper = createColumnHelper<InvoiceFormLineItem>();
  const invoiceColumns = useMemo(
    () =>
      [
        invoiceColumnHelper.accessor("description", {
          header: data.user.project_based ? "Project" : "Line item",
          cell: (info) => (
            <Input
              value={info.getValue()}
              placeholder="Description"
              invalid={info.row.original.errors?.includes("description")}
              onChange={(value) => updateLineItem(info.row.index, { description: value })}
            />
          ),
          footer: () => (
            <div className="flex gap-3">
              <Button variant="link" onClick={addLineItem}>
                <PlusIcon className="inline size-4" />
                Add line item
              </Button>
              {data.company.expenses.enabled ? (
                <Button variant="link" asChild>
                  <label className={canManageExpenses ? "hidden" : ""}>
                    <ArrowUpTrayIcon className="inline size-4" />
                    Add expense
                    <input
                      ref={uploadExpenseRef}
                      type="file"
                      className="hidden"
                      accept="application/pdf, image/*"
                      multiple
                      onChange={createNewExpenseEntries}
                    />
                  </label>
                </Button>
              ) : null}
            </div>
          ),
        }),
        !data.user.project_based
          ? invoiceColumnHelper.accessor("minutes", {
              header: "Hours",
              cell: (info) => (
                <DurationInput
                  value={info.row.original.minutes}
                  aria-label="Hours"
                  invalid={info.row.original.errors?.includes("minutes")}
                  onChange={(value) =>
                    updateLineItem(info.row.index, {
                      minutes: value,
                      total_amount_cents: Math.ceil(info.row.original.pay_rate_in_subunits * ((value ?? 0) / 60)),
                    })
                  }
                />
              ),
            })
          : null,
        !data.user.project_based
          ? invoiceColumnHelper.simple(
              "pay_rate_in_subunits",
              "Rate",
              (value) => `${formatMoneyFromCents(value)} / hour`,
              "numeric",
            )
          : null,
        invoiceColumnHelper.accessor("total_amount_cents", {
          header: "Amount",
          cell: (info) =>
            data.user.project_based ? (
              <DecimalInput
                value={info.getValue() / 100}
                onChange={(value) => updateLineItem(info.row.index, { total_amount_cents: (value ?? 0) * 100 })}
                aria-label="Amount"
                placeholder="0"
                prefix="$"
              />
            ) : (
              formatMoneyFromCents(info.getValue())
            ),
          meta: { numeric: true },
        }),
        invoiceColumnHelper.display({
          id: "actions",
          cell: (info) => (
            <Button
              variant="link"
              aria-label="Remove"
              onClick={() => setLineItems((lineItems) => lineItems.delete(info.row.index))}
            >
              <TrashIcon className="size-4" />
            </Button>
          ),
        }),
      ].filter((column) => !!column),
    [canManageExpenses],
  );

  const expenseColumnHelper = createColumnHelper<InvoiceFormExpense>();
  const expenseColumns = useMemo(
    () => [
      expenseColumnHelper.accessor("attachment", {
        header: "Expense",
        cell: (info) => (
          <a href={info.getValue().url} download>
            <PaperClipIcon className="inline size-4" />
            {info.getValue().name}
          </a>
        ),
        footer: () => (
          <Button variant="link" onClick={() => uploadExpenseRef.current?.click()}>
            <PlusIcon className="inline size-4" />
            Add expense
          </Button>
        ),
      }),
      expenseColumnHelper.accessor("description", {
        header: "Merchant",
        cell: (info) => (
          <Input
            value={info.row.original.description}
            aria-label="Merchant"
            invalid={info.row.original.errors?.includes("description")}
            onChange={(description) => updateExpense(info.row.index, { description })}
          />
        ),
      }),
      expenseColumnHelper.accessor("category_id", {
        header: "Category",
        cell: (info) => (
          <Select
            value={info.row.original.category_id.toString()}
            options={data.company.expenses.categories.map((category) => ({
              value: category.id.toString(),
              label: category.name,
            }))}
            aria-label="Category"
            invalid={info.row.original.errors?.includes("category")}
            onChange={(value) => updateExpense(info.row.index, { category_id: Number(value) })}
          />
        ),
      }),
      expenseColumnHelper.accessor("total_amount_in_cents", {
        header: "Amount",
        cell: (info) => (
          <DecimalInput
            value={info.getValue() / 100}
            placeholder="0"
            onChange={(value) => updateExpense(info.row.index, { total_amount_in_cents: (value ?? 0) * 100 })}
            aria-label="Amount"
            invalid={info.row.original.errors?.includes("amount")}
            prefix="$"
          />
        ),
      }),
      expenseColumnHelper.display({
        id: "actions",
        cell: (info) => (
          <Button
            variant="link"
            aria-label="Remove"
            onClick={() => setExpenses((expenses) => expenses.delete(info.row.index))}
          >
            <TrashIcon className="size-4" />
          </Button>
        ),
      }),
    ],
    [],
  );

  const invoiceTable = useTable({ data: useMemo(() => lineItems.toArray(), [lineItems]), columns: invoiceColumns });
  const expenseTable = useTable({ data: useMemo(() => expenses.toArray(), [expenses]), columns: expenseColumns });

  return (
    <MainLayout
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
          <Button variant="primary" onClick={showModal} disabled={submit.isPending}>
            <PaperAirplaneIcon className="size-4" />
            {submit.isPending ? "Sending..." : data.invoice.id ? "Re-submit invoice" : "Send invoice"}
          </Button>
        </>
      }
    >
      {equityCalculation.selectedPercentage !== null ? (
        <EquityPercentageLockModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          percentage={equityCalculation.selectedPercentage}
          year={invoiceYear}
          onComplete={submit.mutate}
        />
      ) : null}

      <section>
        <div className="grid gap-4">
          <div className="grid auto-cols-fr gap-3 md:grid-flow-col">
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
            <div>
              <Input
                value={invoiceNumber}
                onChange={setInvoiceNumber}
                label="Invoice ID"
                invalid={errorField === "invoiceNumber"}
              />
            </div>
            <div>
              <Input
                value={issueDate}
                onChange={setIssueDate}
                label="Date"
                invalid={errorField === "issueDate"}
                type="date"
              />
            </div>
          </div>

          <Table table={invoiceTable} />
          {canManageExpenses ? <Table table={expenseTable} /> : null}

          <footer className="flex flex-col gap-3 lg:flex-row lg:justify-between">
            <Textarea
              value={notes}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
              placeholder="Enter notes about your invoice (optional)"
              className="w-full border-dashed border-gray-100 lg:w-96"
            />
            <Card className="md:self-start">
              {canManageExpenses || equityCalculation.amountInCents > 0 ? (
                <CardRow className="flex justify-between gap-2">
                  <strong>Total services</strong>
                  <span>{formatMoneyFromCents(totalServicesAmountInCents)}</span>
                </CardRow>
              ) : null}
              {canManageExpenses ? (
                <CardRow className="flex justify-between gap-2">
                  <strong>Total expenses</strong>
                  <span>{formatMoneyFromCents(totalExpensesAmountInCents)}</span>
                </CardRow>
              ) : null}
              {equityCalculation.amountInCents > 0 ? (
                <>
                  <CardRow className="flex justify-between gap-2">
                    <strong>Swapped for equity (not paid in cash)</strong>
                    <span>{formatMoneyFromCents(equityCalculation.amountInCents)}</span>
                  </CardRow>
                  <CardRow className="flex justify-between gap-2">
                    <strong>Net amount in cash</strong>
                    <span className="numeric">
                      {formatMoneyFromCents(totalInvoiceAmountInCents - equityCalculation.amountInCents)}
                    </span>
                  </CardRow>
                </>
              ) : (
                <CardRow className="flex justify-between gap-2">
                  <strong>Total</strong>
                  <span className="numeric">{formatMoneyFromCents(totalInvoiceAmountInCents)}</span>
                </CardRow>
              )}
            </Card>
          </footer>
        </div>
      </section>
    </MainLayout>
  );
};

export default Edit;
