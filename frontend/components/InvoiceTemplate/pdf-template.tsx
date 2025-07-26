import { Document, Page, Text, View } from "@react-pdf/renderer";
import React from "react";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import { LineItems } from "./line-items";
import { Meta } from "./meta";
import { Note } from "./notes";
import { Summary } from "./summary";

interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  paidAt?: string | null;
  billFrom: string;
  billTo: string;
  notes?: string | null;
  totalAmountInUsdCents: bigint;
  cashAmountInCents: bigint;
  equityAmountInCents: bigint;
  equityPercentage: number;
  streetAddress?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  countryCode?: string | null;
  company: {
    name: string;
    streetAddress: string | null;
    city: string | null;
    state: string | null;
    zipCode: string | null;
    countryCode: string | null;
  };
  lineItems: {
    description: string;
    quantity: number;
    hourly: boolean;
    payRateInSubunits: number;
  }[];
  expenses: {
    description: string;
    totalAmountInCents: bigint;
    expenseCategory: {
      name: string;
    };
  }[];
}

export function PdfTemplate({ invoice }: { invoice: InvoiceData }) {
  return (
    <Document>
      <Page
        wrap
        size="A4"
        style={{
          padding: 20,
          backgroundColor: "#fff",
          color: "#000",
          fontFamily: "Helvetica",
        }}
      >
        {/* Header */}
        <View style={{ marginBottom: 30 }}>
          <Text style={{ fontSize: 24, fontWeight: "bold", marginBottom: 10 }}>INVOICE</Text>
          <Meta
            invoiceNo={invoice.invoiceNumber}
            issueDate={invoice.invoiceDate}
            dueDate={invoice.paidAt}
            invoiceNoLabel="Invoice #"
            issueDateLabel="Sent on"
            dueDateLabel="Paid on"
          />
        </View>

        {/* Bill From and Bill To */}
        <View style={{ flexDirection: "row", marginBottom: 30 }}>
          <View style={{ flex: 1, marginRight: 20 }}>
            <Text style={{ fontSize: 12, fontWeight: "bold", marginBottom: 5 }}>Bill From:</Text>
            <Text style={{ fontSize: 10, marginBottom: 2 }}>{invoice.billFrom}</Text>
            {invoice.streetAddress ? (
              <Text style={{ fontSize: 10, marginBottom: 2 }}>{invoice.streetAddress}</Text>
            ) : null}
            {invoice.city && invoice.state && invoice.zipCode ? (
              <Text style={{ fontSize: 10, marginBottom: 2 }}>
                {invoice.city}, {invoice.state} {invoice.zipCode}
              </Text>
            ) : null}
            {invoice.countryCode ? <Text style={{ fontSize: 10 }}>{invoice.countryCode}</Text> : null}
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontWeight: "bold", marginBottom: 5 }}>Bill To:</Text>
            <Text style={{ fontSize: 10, marginBottom: 2 }}>{invoice.billTo}</Text>
            {invoice.company.streetAddress ? (
              <Text style={{ fontSize: 10, marginBottom: 2 }}>{invoice.company.streetAddress}</Text>
            ) : null}
            {invoice.company.city && invoice.company.state && invoice.company.zipCode ? (
              <Text style={{ fontSize: 10, marginBottom: 2 }}>
                {invoice.company.city}, {invoice.company.state} {invoice.company.zipCode}
              </Text>
            ) : null}
            {invoice.company.countryCode ? <Text style={{ fontSize: 10 }}>{invoice.company.countryCode}</Text> : null}
          </View>
        </View>

        {/* Line Items */}
        <LineItems
          lineItems={invoice.lineItems.map((item) => {
            const cashFactor = 1 - invoice.equityPercentage / 100;
            // Match the page logic exactly: Math.ceil((lineItem.quantity / (lineItem.hourly ? 60 : 1)) * lineItem.payRateInSubunits)
            const lineItemTotal = Math.ceil((item.quantity / (item.hourly ? 60 : 1)) * item.payRateInSubunits);

            return {
              name: item.description,
              quantity: item.quantity,
              price: item.payRateInSubunits,
              unit: item.hourly ? "hour" : "item",
              _displayPrice: item.payRateInSubunits
                ? `${formatMoneyFromCents(item.payRateInSubunits * cashFactor)}${item.hourly ? " / hour" : ""}`
                : "",
              // Use the exact same calculation as the page
              _calculatedTotal: lineItemTotal * cashFactor,
              // Format quantity for display like the page: formatDuration for hourly, raw for non-hourly
              _displayQuantity: item.hourly
                ? `${Math.floor(item.quantity / 60)
                    .toString()
                    .padStart(2, "0")}:${(item.quantity % 60).toString().padStart(2, "0")}`
                : item.quantity.toString(),
            };
          })}
          currency="USD"
          descriptionLabel="Description"
          quantityLabel="Qty / Hours"
          priceLabel="Rate"
          totalLabel="Amount"
          includeUnits
        />

        {/* Expenses */}
        {invoice.expenses.length > 0 && (
          <View style={{ marginTop: 20 }}>
            <View
              style={{
                flexDirection: "row",
                borderBottomWidth: 0.5,
                borderBottomColor: "#000",
                paddingBottom: 5,
                marginBottom: 5,
              }}
            >
              <Text style={{ flex: 3, fontSize: 9, fontWeight: 500 }}>Expense</Text>
              <Text style={{ flex: 1, fontSize: 9, fontWeight: 500, textAlign: "right" }}>Amount</Text>
            </View>
            {invoice.expenses.map((expense, index) => (
              <View
                key={`expense-${index.toString()}`}
                style={{
                  flexDirection: "row",
                  paddingVertical: 5,
                  alignItems: "flex-start",
                }}
              >
                <Text style={{ flex: 3, fontSize: 9 }}>
                  {expense.expenseCategory.name} – {expense.description}
                </Text>
                <Text style={{ flex: 1, fontSize: 9, textAlign: "right" }}>
                  {formatMoneyFromCents(expense.totalAmountInCents)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Summary */}
        {invoice.lineItems.length > 0 && invoice.expenses.length > 0 && (
          <View style={{ marginTop: 20 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 5 }}>
              <Text style={{ fontSize: 10, fontWeight: "bold" }}>Total services</Text>
              <Text style={{ fontSize: 10 }}>
                {formatMoneyFromCents(
                  invoice.lineItems.reduce((acc, lineItem) => {
                    const cashFactor = 1 - invoice.equityPercentage / 100;
                    // Match the page logic exactly: Math.ceil((lineItem.quantity / (lineItem.hourly ? 60 : 1)) * lineItem.payRateInSubunits)
                    const lineItemTotal = Math.ceil(
                      (lineItem.quantity / (lineItem.hourly ? 60 : 1)) * lineItem.payRateInSubunits,
                    );
                    return acc + lineItemTotal * cashFactor;
                  }, 0),
                )}
              </Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 5 }}>
              <Text style={{ fontSize: 10, fontWeight: "bold" }}>Total expenses</Text>
              <Text style={{ fontSize: 10 }}>
                {formatMoneyFromCents(
                  invoice.expenses.reduce((acc, expense) => acc + expense.totalAmountInCents, BigInt(0)),
                )}
              </Text>
            </View>
            <View style={{ borderTopWidth: 0.5, borderTopColor: "#000", paddingTop: 5, marginTop: 5 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 10, fontWeight: "bold" }}>Total</Text>
                <Text style={{ fontSize: 10, fontWeight: "bold" }}>
                  {formatMoneyFromCents(invoice.cashAmountInCents)}
                </Text>
              </View>
            </View>
          </View>
        )}
        {!(invoice.lineItems.length > 0 && invoice.expenses.length > 0) && (
          <Summary
            amount={invoice.totalAmountInUsdCents}
            currency="USD"
            totalLabel="Total"
            taxLabel="Tax"
            vatLabel="VAT"
          />
        )}

        {/* Notes */}
        <Note content={invoice.notes} noteLabel="Notes:" />

        {/* Equity Information */}
        {invoice.equityPercentage > 0 && (
          <View style={{ marginTop: 20, padding: 10, backgroundColor: "#f5f5f5" }}>
            <Text style={{ fontSize: 10, fontWeight: "bold", marginBottom: 5 }}>Equity Compensation:</Text>
            <Text style={{ fontSize: 10, marginBottom: 2 }}>
              Cash Amount: {formatMoneyFromCents(invoice.cashAmountInCents)}
            </Text>
            <Text style={{ fontSize: 10, marginBottom: 2 }}>
              Equity Value: {formatMoneyFromCents(invoice.equityAmountInCents)} ({invoice.equityPercentage}%)
            </Text>
            <Text style={{ fontSize: 10, fontWeight: "bold" }}>
              Total Value: {formatMoneyFromCents(invoice.totalAmountInUsdCents)}
            </Text>
          </View>
        )}
      </Page>
    </Document>
  );
}
