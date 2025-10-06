import { Container, Heading, Link, Preview } from "@react-email/components";
import React from "react";
import { invoices } from "@/db/schema";
import env from "@/env";
import { LinkButton } from "@/trpc/email";
import EmailLayout from "@/trpc/EmailLayout";
import { formatMoneyFromCents } from "@/utils/formatMoney";

type Invoice = typeof invoices.$inferSelect;
const host = `${env.PROTOCOL}://${env.DOMAIN}`;
const OneOffInvoiceCreated = ({
  companyName,
  invoice,
  bankAccountLastFour,
  paymentDescriptions,
}: {
  companyName: string;
  invoice: Invoice;
  bankAccountLastFour: string | undefined | null;
  paymentDescriptions: string[];
}) => (
  <EmailLayout>
    <Preview>{companyName} has sent you money</Preview>

    <Container className="mb-8">
      <Heading as="h1">{companyName} has sent you money.</Heading>
      <Heading as="h2">
        This one-off payment has been automatically approved and will be processed soon.
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
            <Link href={`${host}/invoices/${invoice.externalId}`} className="text-black">
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

        {invoice.cashAmountInCents > 0 && (
          <div className="mb-4">
            <div className="mb-1 text-gray-500">Cash payment</div>
            <div className="font-bold">{formatMoneyFromCents(invoice.cashAmountInCents)}</div>
          </div>
        )}

        {invoice.equityAmountInCents > 0 && (
          <div className="mb-4">
            <div className="mb-1 text-gray-500">Equity grant</div>
            <div className="font-bold">
              {formatMoneyFromCents(invoice.equityAmountInCents)} ({invoice.equityAmountInOptions.toLocaleString()}{" "}
              options at {invoice.equityPercentage}%)
            </div>
          </div>
        )}

        <div>
          <div className="mb-1 text-gray-500">Bank account</div>
          <div className="font-bold">
            {bankAccountLastFour ? (
              <>****{bankAccountLastFour}</>
            ) : (
              <LinkButton href={`${host}/settings/payouts`}>Connect bank account</LinkButton>
            )}
          </div>
        </div>
      </div>
    </Container>
  </EmailLayout>
);

export default OneOffInvoiceCreated;
