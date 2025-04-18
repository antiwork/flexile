import { Container, Heading, Preview, Text } from "@react-email/components";
import React from "react";
import { LinkButton } from "@/trpc/email";
import EmailLayout from "@/trpc/EmailLayout";

const AdminSigningEmail = ({ userName, documentUrl }: { userName: string; documentUrl: string }) => (
  <EmailLayout>
    <Preview>Equity plan document ready for your signature</Preview>
    <Container className="mb-8">
      <Heading>Equity plan document ready for your signature</Heading>
      <Text>Please review and sign the equity plan document for {userName} at your earliest convenience.</Text>
      <LinkButton href={documentUrl}>Review & sign</LinkButton>
    </Container>
  </EmailLayout>
);

export default AdminSigningEmail;
