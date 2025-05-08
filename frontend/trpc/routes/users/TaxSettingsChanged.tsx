import { Heading, Text } from "@react-email/components";
import React from "react";
import { LinkButton } from "@/trpc/email";
import EmailLayout from "@/trpc/EmailLayout";

const TaxSettingsChanged = ({ host, documentId, name }: { host: string; documentId: bigint | null; name: string }) => (
  <EmailLayout>
    <Heading>Signature required</Heading>
    <Text>
      {name} has updated their tax information. Your signature is required on the updated contract to allow them to
      submit new invoices.
    </Text>

    <LinkButton href={`https://${host}/documents?sign=${documentId}`}>Review & sign</LinkButton>
  </EmailLayout>
);

export default TaxSettingsChanged;
