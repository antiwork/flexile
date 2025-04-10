import { Heading, Text } from "@react-email/components";
import { format } from "date-fns";
import React from "react";
import { LinkButton } from "@/trpc/email";
import EmailLayout from "@/trpc/EmailLayout";
import { formatMoneyFromCents } from "@/utils/formatMoney";

const RateUpdated = ({
  host,
  oldRate,
  newRate,
  documentId,
}: {
  host: string;
  oldRate: number;
  newRate: number;
  documentId: bigint | null;
}) => (
  <EmailLayout>
    <Heading>Your rate has changed!</Heading>
    <Text>
      <span className="text-gray-500">Old rate</span>
      <br />
      <del>{formatMoneyFromCents(oldRate)}/hr</del>
    </Text>
    <Text>
      <span className="text-gray-500">New rate</span>
      <br />
      <span>{formatMoneyFromCents(newRate)}/hr</span>
    </Text>
    <Text>The new rate will apply to invoices submitted after {format(new Date(), "MMMM d, yyyy")}.</Text>

    {newRate > oldRate && <Text>Congrats!</Text>}

    {documentId ? (
      <>
        <Text>We created a new contract with your updated information.</Text>

        <LinkButton href={`https://${host}/documents?sign=${documentId}`}>Review & sign</LinkButton>
      </>
    ) : null}
  </EmailLayout>
);

export default RateUpdated;
