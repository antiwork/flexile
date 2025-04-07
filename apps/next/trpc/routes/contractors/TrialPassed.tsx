import { companies } from "@/db/schema";
import { LinkButton } from "@/trpc/email";
import EmailLayout from "@/trpc/EmailLayout";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import React from "react";

const TrialPassed = ({
  company,
  host,
  oldPayRateInSubunits,
  newPayRateInSubunits,
}: {
  company: typeof companies.$inferSelect;
  host: string;
  oldPayRateInSubunits: number;
  newPayRateInSubunits: number;
}) => (
  <EmailLayout>
    <h1>Big congratulations - you are officially joining the {company.name} team!</h1>

    <p>
      Here's some great news: Your rate has been bumped up to {formatMoneyFromCents(newPayRateInSubunits)} per hour from
      the previous trial rate of {formatMoneyFromCents(oldPayRateInSubunits)}. You'll see this updated rate on your next
      invoice.
    </p>

    <p>
      Also, you now have the option to convert a portion of your cash earnings to equity in the company. Just keep in
      mind, once you decide on the percentage, it will be locked in for the year.
    </p>

    <LinkButton href={`https://${host}/settings/equity`}>Select your equity allocation</LinkButton>

    <p>Welcome aboard!</p>

    <p className="mb-4">
      Best,
      <br />
      The Flexile Team
    </p>
  </EmailLayout>
);

export default TrialPassed;
