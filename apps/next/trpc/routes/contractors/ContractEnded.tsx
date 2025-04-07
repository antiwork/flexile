import { format } from "date-fns";
import { companies, companyContractors, users } from "@/db/schema";
import { LinkButton } from "@/trpc/email";
import EmailLayout from "@/trpc/EmailLayout";
import { userDisplayName } from "@/trpc/routes/users";
import { assertDefined } from "@/utils/assert";
import React from "react";

const ContractEnded = ({
  contractor,
  company,
  user,
  host,
}: {
  contractor: typeof companyContractors.$inferSelect;
  company: typeof companies.$inferSelect;
  user: typeof users.$inferSelect;
  host: string;
}) => {
  const endedAt = assertDefined(contractor.endedAt);

  return (
    <EmailLayout>
      <h1>Your contract with {company.name} has ended.</h1>

      <p>Hey {userDisplayName(user)},</p>

      <p>
        Your contract with {company.name} has ended on {format(endedAt, "MMMM d, yyyy")}. You can still submit invoices
        at any time.
      </p>

      <LinkButton href={`https://${host}/companies/${company.externalId}/invoices/new`}>Submit your invoice</LinkButton>

      <p>You can still use Flexile to see and download your invoice history.</p>

      <p className="mb-4">
        Best,
        <br />
        The Flexile Team
      </p>
    </EmailLayout>
  );
};

export default ContractEnded;
