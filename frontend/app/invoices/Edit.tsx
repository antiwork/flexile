"use client";

import { ArrowUpTrayIcon, PlusIcon } from "@heroicons/react/16/solid";
import { PaperAirplaneIcon, PaperClipIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { List } from "immutable";
import Link from "next/link";
import { redirect, useParams, useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useId, useRef, useState } from "react";
import { z } from "zod";
import ComboBox from "@/components/ComboBox";
import DurationInput from "@/components/DurationInput";
import MainLayout from "@/components/layouts/Main";
import NumberInput from "@/components/NumberInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { LegacyAddress as Address, useCanSubmitInvoices } from ".";
import { Card, CardContent } from "@/components/ui/card";
import { MAX_EQUITY_PERCENTAGE } from "@/models";
import RangeInput from "@/components/RangeInput";
import { EquityAllocationStatus } from "@/db/enums";
import DatePicker from "@/components/DatePicker";
import { type DateValue, parseDate } from "@internationalized/date";

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
  const { canSubmitInvoices } = useCanSubmitInvoices();
  const uid = useId();
  if (!canSubmitInvoices) throw redirect("/invoices");
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [showExpenses, setShowExpenses] = useState(!!searchParams.get("expenses"));
  const [errorField, setErrorField] = useState<string | null>(null);
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
  const [issueDate, setIssueDate] = useState<DateValue>(() =>
    parseDate(searchParams.get("date") || data.invoice.invoice_date),
  );
  const invoiceYear = issueDate.year;
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

  const [equityAllocation, { refetch: refetchEquityAllocation }] = trpc.equityAllocations.forYear.useSuspenseQuery({
    companyId: company.id,
    year: invoiceYear,
  });
  const [equityPercentage, setEquityPercent] = useState(
    parseInt(searchParams.get("split") ?? "", 10) || equityAllocation?.equityPercentage || 0,
  );

  const equityPercentageMutation = trpc.equitySettings.update.useMutation();
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

      if (equityPercentage !== data.equity_allocation?.percentage && !data.equity_allocation?.is_locked) {
        await equityPercentageMutation.mutateAsync({ companyId: company.id, equityPercentage, year: invoiceYear });
      }
      await request({
        method: id ? "PATCH" : "POST",
        url: id ? company_invoice_path(company.id, id) : company_invoices_path(company.id),
        accept: "json",
        formData,
        assertOk: true,
      });
      await trpcUtils.invoices.list.invalidate({ companyId: company.id });
      await trpcUtils.documents.list.invalidate();
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
    selectedPercentage: equityPercentage,
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

  useEffect(() => {
    setEquityPercent(equityAllocation?.equityPercentage ?? 0);
  }, [equityAllocation]);

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
          <Button variant="primary" onClick={() => validate() && submit.mutate()} disabled={submit.isPending}>
            <PaperAirplaneIcon className="size-4" />
            {submit.isPending ? "Sending..." : data.invoice.id ? "Re-submit invoice" : "Send invoice"}
          </Button>
        </>
      }
    >
      {company.equityCompensationEnabled &&
      (!equityAllocation || equityAllocation.status === EquityAllocationStatus.PendingConfirmation) ? (
        <section className="mb-6">
          <Card>
            <CardContent>
              <div className="grid gap-2">
                <Label htmlFor={`${uid}-equity-split`}>Confirm your equity split for {invoiceYear}</Label>
                <RangeInput
                  id={`${uid}-equity-split`}
                  value={equityPercentage}
                  onChange={setEquityPercent}
                  min={0}
                  max={MAX_EQUITY_PERCENTAGE}
                  aria-label="Cash vs equity split"
                  unit="%"
                />
              </div>
              <p className="mt-4">
                By submitting this invoice, your current equity selection will be locked for all {invoiceYear}.{" "}
                <strong>
                  You won't be able to choose a different allocation until the next options grant for {invoiceYear + 1}.
                </strong>
              </p>
            </CardContent>
          </Card>
        </section>
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
                  void refetchEquityAllocation();
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
                <TableHead>{data.user.project_based ? "Project" : "Line item"}</TableHead>
                {data.user.project_based ? null : (
                  <>
                    <TableHead>Hours</TableHead>
                    <TableHead>Rate</TableHead>
                  </>
                )}
                <TableHead>Amount</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineItems.toArray().map((item, rowIndex) => (
                <TableRow key={rowIndex}>
                  <TableCell>
                    <Input
                      value={item.description}
                      placeholder="Description"
                      aria-invalid={item.errors?.includes("description")}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateLineItem(rowIndex, { description: e.target.value })
                      }
                    />
                  </TableCell>
                  {data.user.project_based ? null : (
                    <>
                      <TableCell>
                        <div className="grid gap-2">
                          <Label htmlFor={`hours-${rowIndex}`} className="sr-only">
                            Hours
                          </Label>
                          <DurationInput
                            id={`hours-${rowIndex}`}
                            value={item.minutes}
                            aria-label="Hours"
                            aria-invalid={item.errors?.includes("minutes")}
                            onChange={(value) =>
                              updateLineItem(rowIndex, {
                                minutes: value,
                                total_amount_cents: Math.ceil(item.pay_rate_in_subunits * ((value ?? 0) / 60)),
                              })
                            }
                          />
                        </div>
                      </TableCell>
                      <TableCell>{`${formatMoneyFromCents(item.pay_rate_in_subunits)} / hour`}</TableCell>
                    </>
                  )}
                  <TableCell>
                    {data.user.project_based ? (
                      <NumberInput
                        value={item.total_amount_cents / 100}
                        onChange={(value: number | null) =>
                          updateLineItem(rowIndex, { total_amount_cents: (value ?? 0) * 100 })
                        }
                        aria-label="Amount"
                        placeholder="0"
                        prefix="$"
                        decimal
                      />
                    ) : (
                      formatMoneyFromCents(item.total_amount_cents)
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="link"
                      aria-label="Remove"
                      onClick={() => setLineItems((lineItems) => lineItems.delete(rowIndex))}
                    >
                      <TrashIcon className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={data.user.project_based ? 3 : 5}>
                  <div className="flex gap-3">
                    <Button variant="link" onClick={addLineItem}>
                      <PlusIcon className="inline size-4" />
                      Add line item
                    </Button>
                    {data.company.expenses.enabled && canManageExpenses ? (
                      <Button variant="link" asChild>
                        <Label>
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
                        </Label>
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
          {canManageExpenses ? (
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
                        options={data.company.expenses.categories.map((category) => ({
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
                    <Button variant="link" onClick={() => uploadExpenseRef.current?.click()}>
                      <PlusIcon className="inline size-4" />
                      Add expense
                    </Button>
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          ) : null}

          <footer className="flex flex-col gap-3 lg:flex-row lg:justify-between">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter notes about your invoice (optional)"
              className="w-full lg:w-96"
            />
            <div className="flex flex-col gap-2 md:self-start lg:items-end">
              {canManageExpenses || equityCalculation.amountInCents > 0 ? (
                <div className="flex flex-col items-end">
                  <span>Total services</span>
                  <span className="numeric text-xl">{formatMoneyFromCents(totalServicesAmountInCents)}</span>
                </div>
              ) : null}
              {canManageExpenses ? (
                <div className="flex flex-col items-end">
                  <span>Total expenses</span>
                  <span className="numeric text-xl">{formatMoneyFromCents(totalExpensesAmountInCents)}</span>
                </div>
              ) : null}
              {equityCalculation.amountInCents > 0 ? (
                <>
                  <div className="flex flex-col items-end">
                    <span>Swapped for equity (not paid in cash)</span>
                    <span className="numeric text-xl">{formatMoneyFromCents(equityCalculation.amountInCents)}</span>
                  </div>
                  <Separator />
                  <div className="flex flex-col items-end">
                    <span>Net amount in cash</span>
                    <span className="numeric text-3xl">
                      {formatMoneyFromCents(totalInvoiceAmountInCents - equityCalculation.amountInCents)}
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
    </MainLayout>
  );
};

export default Edit;
