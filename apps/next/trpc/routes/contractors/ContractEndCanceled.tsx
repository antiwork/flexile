import { companies, users } from "@/db/schema";
import { LinkButton } from "@/trpc/email";
import EmailLayout from "@/trpc/EmailLayout";
import { userDisplayName } from "@/trpc/routes/users";
import React from "react";

const ContractEndCanceled = ({
  company,
  user,
  host,
}: {
  company: typeof companies.$inferSelect;
  user: typeof users.$inferSelect;
  host: string;
}) => (
  <EmailLayout>
    <h1>Your contract end with {company.name} has been canceled</h1>

    <p>Hey {userDisplayName(user)},</p>

    <p>
      Good news! The scheduled end date for your contract with {company.name} has been removed. Your contract will
      continue as normal.
    </p>

    <p>You can continue to submit invoices through Flexile as you have been doing.</p>

    <LinkButton href={`https://${host}/companies/${company.externalId}/invoices/new`}>Submit an invoice</LinkButton>

    <p>If you have any questions, please reach out to your contact at {company.name}.</p>

    <p className="mb-4">
      Best,
      <br />
      The Flexile Team
    </p>
  </EmailLayout>
);

export default ContractEndCanceled;
