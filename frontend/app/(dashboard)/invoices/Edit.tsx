"use client";

import { PaperClipIcon, TrashIcon } from "@heroicons/react/24/outline";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDate, parseDate } from "@internationalized/date";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { CircleAlert, Plus, Upload } from "lucide-react";
import Link from "next/link";
import { redirect, useParams, useRouter, useSearchParams } from "next/navigation";
import React, { useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import ComboBox from "@/components/ComboBox";
import { DashboardHeader } from "@/components/DashboardHeader";
import DatePicker from "@/components/DatePicker";
import { linkClasses } from "@/components/Link";
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
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
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

const invoiceSchema = z
  .object({
    invoiceNumber: z.string().min(1, "Invoice number is required"),
    issueDate: z.instanceof(CalendarDate, { message: "Date is required" }),
    notes: z.string(),
    lineItems: z.array(
      z.object({
        id: z.number().optional(),
        description: z.string().min(1, "Description is required"),
        billingDetails: z
          .object({
            quantity: z.number().min(0.01, "Quantity must be at least 0.01"),
            hourly: z.boolean(),
          })
          .nullable(),
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
        blob: z.instanceof(File).optional(),
      }),
    ),
    document: z
      .object({
        name: z.string(),
        url: z.string(),
        signed_id: z.string().optional(),
        blob: z.instanceof(File).optional(),
      })
      .nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.lineItems.length === 0 && data.expenses.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one line item or expense is required",
        path: ["lineItems"],
        fatal: true,
      });
    }
    data.lineItems.forEach((lineItem, index) => {
      if (lineItem.description && !lineItem.billingDetails) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Quantity is required",
          path: ["lineItems", index, "billingDetails"],
        });
      }
      if (lineItem.pay_rate_in_subunits <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Pay rate must be greater than $0.00",
          path: ["lineItems", index, "pay_rate_in_subunits"],
        });
      }
    });
  });

type InvoiceFormData = z.infer<typeof invoiceSchema>;

const Edit = () => {
  const user = useCurrentUser();
  const company = useCurrentCompany();
  const { canSubmitInvoices } = useCanSubmitInvoices();
  if (!canSubmitInvoices) throw redirect("/invoices");
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const trpcUtils = trpc.useUtils();
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
  const form = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
    mode: "onChange",
    defaultValues: {
      invoiceNumber: data.invoice.invoice_number,
      issueDate: parseDate(searchParams.get("date") || data.invoice.invoice_date),
      notes: data.invoice.notes ?? "",
      lineItems: data.invoice.line_items.length
        ? data.invoice.line_items.map((item) => ({
            id: item.id,
            description: item.description,
            billingDetails: item.quantity
              ? {
                  quantity: parseFloat(item.quantity),
                  hourly: item.hourly,
                }
              : null,
            pay_rate_in_subunits: item.pay_rate_in_subunits,
          }))
        : [
            {
              description: "",
              billingDetails: {
                quantity: parseFloat(searchParams.get("quantity") ?? "") || (data.user.project_based ? 1 : 60),
                hourly: searchParams.has("hourly") ? searchParams.get("hourly") === "true" : !data.user.project_based,
              },
              pay_rate_in_subunits: parseInt(searchParams.get("rate") ?? "", 10) || (payRateInSubunits ?? 0),
            },
          ],
      expenses: data.invoice.expenses,
      document: data.invoice.attachment,
    },
  });

  const {
    fields: lineItemFields,
    append: appendLineItem,
    remove: removeLineItem,
  } = useFieldArray({
    control: form.control,
    name: "lineItems",
  });

  const {
    fields: expenseFields,
    append: appendExpense,
    remove: removeExpense,
  } = useFieldArray({
    control: form.control,
    name: "expenses",
  });

  const lineItems = form.watch("lineItems");
  const expenses = form.watch("expenses");
  const document = form.watch("document");

  const uploadExpenseRef = useRef<HTMLInputElement>(null);
  const uploadDocumentRef = useRef<HTMLInputElement>(null);
  const actionColumnClass = "w-12";

  const submit = useMutation({
    mutationFn: async (formDataToSubmit: InvoiceFormData) => {
      const formData = new FormData();
      formData.append("invoice[invoice_number]", formDataToSubmit.invoiceNumber);
      formData.append("invoice[invoice_date]", formDataToSubmit.issueDate.toString());

      for (const lineItem of formDataToSubmit.lineItems) {
        if (!lineItem.description || !lineItem.billingDetails) continue;

        if (lineItem.id) {
          formData.append("invoice_line_items[][id]", lineItem.id.toString());
        }
        formData.append("invoice_line_items[][description]", lineItem.description);
        formData.append("invoice_line_items[][quantity]", lineItem.billingDetails.quantity.toString());
        formData.append("invoice_line_items[][hourly]", lineItem.billingDetails.hourly.toString());
        formData.append("invoice_line_items[][pay_rate_in_subunits]", lineItem.pay_rate_in_subunits.toString());
      }

      for (const expense of formDataToSubmit.expenses) {
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

      if (formDataToSubmit.notes.length) {
        formData.append("invoice[notes]", formDataToSubmit.notes);
      }

      if (formDataToSubmit.document) {
        if (formDataToSubmit.document.blob) formData.append("invoice[attachment]", formDataToSubmit.document.blob);
        else if (formDataToSubmit.document.signed_id)
          formData.append("invoice[attachment]", formDataToSubmit.document.signed_id);
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

  const addLineItem = () => {
    appendLineItem({
      description: "",
      billingDetails: {
        quantity: data.user.project_based ? 1 : 60,
        hourly: !data.user.project_based,
      },
      pay_rate_in_subunits: payRateInSubunits ?? 0,
    });
  };

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

    // Add each valid file as a separate expense
    validFiles.forEach((file) => {
      appendExpense({
        description: "",
        category_id: expenseCategory.id,
        total_amount_in_cents: 0,
        attachment: { name: file.name, url: URL.createObjectURL(file) },
        blob: file,
      });
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

    form.setValue("document", {
      name: file.name,
      url: URL.createObjectURL(file),
      blob: file,
    });
  };

  const lineItemTotal = (lineItem: InvoiceFormData["lineItems"][number]) => {
    const quantity = lineItem.billingDetails?.quantity ?? 0;
    const divisor = lineItem.billingDetails?.hourly ? 60 : 1;
    const result = Math.ceil((quantity / divisor) * lineItem.pay_rate_in_subunits);
    return result;
  };
  const totalExpensesAmountInCents = expenses.reduce((acc: number, expense) => acc + expense.total_amount_in_cents, 0);
  const totalServicesAmountInCents = lineItems.reduce((acc: number, lineItem) => acc + lineItemTotal(lineItem), 0);
  const totalInvoiceAmountInCents = totalServicesAmountInCents + totalExpensesAmountInCents;
  const [equityCalculation] = trpc.equityCalculations.calculate.useSuspenseQuery({
    companyId: company.id,
    servicesInCents: totalServicesAmountInCents,
    invoiceYear: form.watch("issueDate").year,
  });
  const onSubmit = form.handleSubmit(
    (formData) => submit.mutate(formData),
    (errors) => {
      if (errors.lineItems?.root?.message) {
        setAlertTitle("Add items to your invoice");
        setAlertMessage(String(errors.lineItems.root.message));
        setAlertOpen(true);
      }
    },
  );

  return (
    <Form {...form}>
      <form
        className="flex flex-col gap-2 md:gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmit(e);
        }}
      >
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
              <Button type="submit" variant="primary" disabled={submit.isPending}>
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
                <FormField
                  control={form.control}
                  name="invoiceNumber"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <Label htmlFor="invoice-id">Invoice ID</Label>
                      <FormControl>
                        <Input id="invoice-id" {...field} aria-invalid={!!fieldState.error} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex flex-col gap-2">
                <FormField
                  control={form.control}
                  name="issueDate"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormControl>
                        <DatePicker
                          {...field}
                          onChange={(date) => date && field.onChange(date)}
                          aria-invalid={!!fieldState.error}
                          label="Invoice date"
                          granularity="day"
                        />
                      </FormControl>
                    </FormItem>
                  )}
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
                {lineItemFields.map((field, rowIndex) => (
                  <TableRow key={field.id}>
                    <TableCell>
                      <FormField
                        control={form.control}
                        name={`lineItems.${rowIndex}.description`}
                        render={({ field, fieldState }) => (
                          <FormItem>
                            <FormControl>
                              <Input {...field} placeholder="Description" aria-invalid={!!fieldState.error} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <FormField
                        control={form.control}
                        name={`lineItems.${rowIndex}.billingDetails`}
                        render={({ field, fieldState }) => (
                          <FormItem>
                            <FormControl>
                              <QuantityInput {...field} aria-label="Hours / Qty" aria-invalid={!!fieldState.error} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <FormField
                        control={form.control}
                        name={`lineItems.${rowIndex}.pay_rate_in_subunits`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <NumberInput
                                value={field.value / 100}
                                onChange={(value: number | null) => field.onChange((value ?? 0) * 100)}
                                aria-label="Rate"
                                placeholder="0"
                                prefix="$"
                                decimal
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      {formatMoneyFromCents(
                        lineItemTotal(
                          lineItems[rowIndex] ?? {
                            pay_rate_in_subunits: 0,
                            billingDetails: { quantity: 0, hourly: false },
                            description: "",
                          },
                        ),
                      )}
                    </TableCell>
                    <TableCell className={actionColumnClass}>
                      <Button variant="link" aria-label="Remove" onClick={() => removeLineItem(rowIndex)}>
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
                        <Plus className="inline size-4" />
                        Add line item
                      </Button>
                      {data.company.expense_categories.length && expenses.length === 0 ? (
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
            {expenses.length > 0 ? (
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
                  {expenseFields.map((field, rowIndex) => (
                    <TableRow key={field.id}>
                      <TableCell>
                        <a href={expenses[rowIndex]?.attachment.url} download>
                          <PaperClipIcon className="inline size-4" />
                          {expenses[rowIndex]?.attachment.name}
                        </a>
                      </TableCell>
                      <TableCell>
                        <FormField
                          control={form.control}
                          name={`expenses.${rowIndex}.description`}
                          render={({ field, fieldState }) => (
                            <FormItem>
                              <FormControl>
                                <Input {...field} aria-label="Merchant" aria-invalid={!!fieldState.error} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <FormField
                          control={form.control}
                          name={`expenses.${rowIndex}.category_id`}
                          render={({ field, fieldState }) => (
                            <FormItem>
                              <FormControl>
                                <ComboBox
                                  value={field.value.toString()}
                                  options={data.company.expense_categories.map((category) => ({
                                    value: category.id.toString(),
                                    label: category.name,
                                  }))}
                                  aria-label="Category"
                                  aria-invalid={!!fieldState.error}
                                  onChange={(value) => field.onChange(Number(value))}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <FormField
                          control={form.control}
                          name={`expenses.${rowIndex}.total_amount_in_cents`}
                          render={({ field, fieldState }) => (
                            <FormItem>
                              <FormControl>
                                <NumberInput
                                  value={field.value / 100}
                                  placeholder="0"
                                  onChange={(value: number | null) => field.onChange((value ?? 0) * 100)}
                                  aria-label="Amount"
                                  aria-invalid={!!fieldState.error}
                                  prefix="$"
                                  decimal
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <Button variant="link" aria-label="Remove" onClick={() => removeExpense(rowIndex)}>
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
                      <Button variant="link" aria-label="Remove" onClick={() => form.setValue("document", null)}>
                        <TrashIcon className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            ) : null}

            <footer className="mx-4 flex flex-col gap-3 lg:flex-row lg:justify-between">
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Enter notes about your invoice (optional)"
                        className="w-full whitespace-pre-wrap lg:w-96"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="flex flex-col gap-2 md:self-start lg:items-end">
                {expenses.length > 0 || company.equityEnabled ? (
                  <div className="flex flex-col items-end">
                    <span>Total services</span>
                    <span className="numeric text-xl">{formatMoneyFromCents(totalServicesAmountInCents)}</span>
                  </div>
                ) : null}
                {expenses.length > 0 ? (
                  <div className="flex flex-col items-end">
                    <span>Total expenses</span>
                    <span className="numeric text-xl">{formatMoneyFromCents(totalExpensesAmountInCents)}</span>
                  </div>
                ) : null}
                {company.equityEnabled ? (
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
      </form>
    </Form>
  );
};

Edit.displayName = "Edit";

export default Edit;
