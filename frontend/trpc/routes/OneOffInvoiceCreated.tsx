import { Container, Heading, Link, Preview } from "@react-email/components";
import React from "react";
import { invoices } from "@/db/schema";
import { LinkButton } from "@/trpc/email";
import EmailLayout from "@/trpc/EmailLayout";
import { formatMoneyFromCents } from "@/utils/formatMoney";

type Invoice = typeof invoices.$inferSelect;

const OneOffInvoiceCreated = ({
  host,
  companyName,
  invoice,
  bankAccountLastFour,
  paymentDescriptions,
}: {
  host: string;
  companyName: string;
  invoice: Invoice;
  bankAccountLastFour: string | undefined | null;
  paymentDescriptions: string[];
}) => (
  <EmailLayout>
    <Preview>{companyName} would like to send you money</Preview>

    <Container className="mb-8">
      <Heading as="h1">{companyName} would like to send you money.</Heading>
      <Heading as="h2">
        Please review the information below and click the link to accept.
        {!bankAccountLastFour ? " You'll also need to connect your bank account to receive payment." : null}
      </Heading>

      <div className="mb-4">
        <div className="mb-4">
          <div className="mb-1 text-gray-500">Client</div>
          <div className="font-bold">{companyName}</div>
        </div>

        <div className="mb-4">
          <div className="mb-1 text-gray-500">Invoice ID</div>
          <div className="font-bold">
            <Link href={`https://${host}/invoices/${invoice.externalId}`} className="text-black">
              {invoice.invoiceNumber}
            </Link>
          </div>
        </div>

        {paymentDescriptions.length > 0 && (
          <div className="mb-4">
            <div className="mb-1 text-gray-500">Description</div>
            <div className="font-bold">
              {paymentDescriptions.map((description, i) => (
                <React.Fragment key={i}>
                  {description}
                  <br />
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

        <div className="mb-4">
          <div className="mb-1 text-gray-500">Total</div>
          <div className="font-bold">{formatMoneyFromCents(invoice.totalAmountInUsdCents)}</div>
        </div>

        {invoice.equityAmountInCents > 0 && (
          <div className="mb-4">
            <div className="mb-1 text-gray-500">Amount to be paid in cash</div>
            <div className="font-bold">{formatMoneyFromCents(invoice.cashAmountInCents)}</div>
          </div>
        )}

        {invoice.minAllowedEquityPercentage && invoice.maxAllowedEquityPercentage ? (
          <div className="mb-4">
            <div className="mb-1 text-gray-500">Able to be swapped for equity</div>
            <div className="font-bold">
              {invoice.minAllowedEquityPercentage}% - {invoice.maxAllowedEquityPercentage}%
            </div>
          </div>
        ) : invoice.equityAmountInCents > 0 ? (
          <div className="mb-4">
            <div className="mb-1 text-gray-500">Amount to be paid in equity</div>
            <div className="font-bold">
              {formatMoneyFromCents(invoice.equityAmountInCents)} ({invoice.equityAmountInOptions.toLocaleString()}{" "}
              options)
            </div>
          </div>
        ) : null}

        <div>
          <div className="mb-1 text-gray-500">Bank account</div>
          <div className="font-bold">
            {bankAccountLastFour ? (
              <>****{bankAccountLastFour}</>
            ) : (
              <LinkButton href={`https://${host}/settings/payouts`}>Connect bank account</LinkButton>
            )}
          </div>
        </div>
      </div>

      <LinkButton href={`https://${host}/invoices/${invoice.externalId}?accept=true`}>Accept payment</LinkButton>
    </Container>
  </EmailLayout>
);

export default OneOffInvoiceCreated;
