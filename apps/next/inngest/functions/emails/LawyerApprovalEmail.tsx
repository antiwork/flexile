import { Container, Heading, Preview, Text } from "@react-email/components";
import React from "react";
import { LinkButton } from "@/trpc/email";
import EmailLayout from "@/trpc/EmailLayout";

export const LawyerApprovalEmail = ({
  contractorName,
  companyName,
  documentUrl,
}: {
  contractorName: string;
  companyName: string;
  documentUrl: string;
}) => (
  <EmailLayout>
    <Preview>Board consent document requires your approval</Preview>
    <Container className="mb-8">
      <Heading>Board consent document requires your approval</Heading>
      <Text>
        A new board consent document has been created for {contractorName} at {companyName} and requires your approval.
      </Text>
      <LinkButton href={documentUrl}>Review and approve document</LinkButton>
      <Text>Thank you for your prompt attention to this matter.</Text>
    </Container>
  </EmailLayout>
);
