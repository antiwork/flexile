import { Container, Heading, Preview, Text } from "@react-email/components";
import React from "react";
import { LinkButton } from "@/trpc/email";
import EmailLayout from "@/trpc/EmailLayout";
const BoardSigningEmail = ({ contractorName, documentUrl }: { contractorName: string; documentUrl: string }) => (
  <EmailLayout>
    <Preview>Board consent document ready for signature</Preview>

    <Container className="mb-8">
      <Heading>Board consent document ready for your signature</Heading>
      <Text>Please review and sign the board consent document for {contractorName} at your earliest convenience.</Text>
      <LinkButton href={documentUrl}>Review & sign</LinkButton>
    </Container>
  </EmailLayout>
);

export default BoardSigningEmail;
