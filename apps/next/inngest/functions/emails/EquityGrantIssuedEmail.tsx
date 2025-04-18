import { Container, Heading, Preview, Section, Text } from "@react-email/components";
import { format } from "date-fns";
import React from "react";
import { equityGrants, vestingSchedules } from "@/db/schema";
import { LinkButton } from "@/trpc/email";
import EmailLayout from "@/trpc/EmailLayout";

type Grant = typeof equityGrants.$inferSelect;
type VestingSchedule = typeof vestingSchedules.$inferSelect;

const formatNumber = (num: number) => new Intl.NumberFormat().format(num);
const formatCurrency = (num: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(num);
const formatDateMedium = (date: Date) => format(date, "d MMM yyyy");
const formatDateDayMonthYear = (date: Date) => format(date, "dd MMM yyyy");
const pluralize = (count: number, singular: string, plural = `${singular}s`) => (count === 1 ? singular : plural);

interface EquityGrantIssuedEmailProps {
  companyName: string;
  grant: Grant;
  vestingSchedule: VestingSchedule | null;
  signGrantUrl: string;
}

const EquityGrantIssuedEmail = ({ companyName, grant, vestingSchedule, signGrantUrl }: EquityGrantIssuedEmailProps) => {
  let vestingText = "";

  if (grant.vestingScheduleId && vestingSchedule) {
    const totalMonths = vestingSchedule.totalVestingDurationMonths;
    const cliffMonths = vestingSchedule.cliffDurationMonths;
    const frequencyMonths = vestingSchedule.vestingFrequencyMonths;

    vestingText = `Your options will vest over ${totalMonths} ${pluralize(totalMonths, "month")}`;
    vestingText += ` starting ${formatDateMedium(grant.periodStartedAt)}`;

    if (cliffMonths > 0) {
      vestingText += ` with a ${cliffMonths} ${pluralize(cliffMonths, "month")} cliff`;
    }

    if (frequencyMonths === 1) {
      vestingText += " with vesting occurring monthly";
    } else {
      vestingText += ` with vesting occurring every ${frequencyMonths} ${pluralize(frequencyMonths, "month")}`;
    }

    if (cliffMonths > 0) {
      vestingText += " after cliff";
    }

    vestingText += ".";
  } else if (grant.vestingTrigger === "invoice_paid") {
    vestingText =
      "Options will be vested upon each paid invoice, based on the amount of cash swapped for equity and the last public valuation of the company. Any options not vested by the end of this year will be forfeited, and a new grant will be issued for the next calendar year.";
  }

  return (
    <EmailLayout>
      <Preview>{companyName} has granted you stock options</Preview>
      <Container className="mb-8">
        <Heading>{companyName} has granted you stock options</Heading>

        <Text>Taking on this grant comes at no cost to you, nor does it obligate you to exercise your options.</Text>

        {[
          {
            term: "Issuer",
            description: companyName,
          },
          {
            term: "Number of options",
            description: formatNumber(grant.numberOfShares),
          },
          {
            term: "Exercise price",
            description: formatCurrency(Number(grant.exercisePriceUsd)),
          },
          {
            term: "Grant date",
            description: formatDateMedium(grant.issuedAt),
          },
          {
            term: "Expiration date",
            description: (
              <>
                {formatDateDayMonthYear(grant.expiresAt)}
                {grant.voluntaryTerminationExerciseMonths ? (
                  <>
                    <br />
                    OR
                    <br />
                    {grant.voluntaryTerminationExerciseMonths}{" "}
                    {pluralize(grant.voluntaryTerminationExerciseMonths, "month")} after leaving {companyName}
                  </>
                ) : null}
              </>
            ),
          },
        ].map((item, index) => (
          <Section key={index} className="mb-2">
            <div className="flex">
              <div className="w-1/3 font-bold">{item.term}</div>
              <div className="w-2/3">{item.description}</div>
            </div>
          </Section>
        ))}

        {vestingText ? <Text>{vestingText}</Text> : null}

        <LinkButton href={signGrantUrl}>Sign and accept your grant</LinkButton>
      </Container>
    </EmailLayout>
  );
};

export default EquityGrantIssuedEmail;
