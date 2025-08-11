import { Heading, Img, Preview, Text } from "@react-email/components";
import React from "react";
import { companies, companyUpdates } from "@/db/schema";
import { RichText } from "@/trpc/email";
import EmailLayout from "@/trpc/EmailLayout";
import { companyName } from "@/trpc/routes/companies";

type Company = typeof companies.$inferSelect;
type Update = typeof companyUpdates.$inferSelect;
const CompanyUpdatePublished = ({
  company,
  update,
  senderName,
  logoUrl,
}: {
  company: Company;
  update: Update;
  senderName: string;
  logoUrl: string | null;
}) => (
  <EmailLayout footer={<Text>Company updates are still in beta. A way to unsubscribe is coming soon!</Text>}>
    <Preview>
      {update.title} from {senderName}
    </Preview>
    <table>
      <tr>
        {logoUrl ? (
          <td style={{ verticalAlign: "middle", paddingRight: "8px" }}>
            <Img src={logoUrl} alt="" height={32} width={32} className="rounded-md" />
          </td>
        ) : null}
        <td style={{ verticalAlign: "middle" }}>
          <Heading as="h2">{companyName(company)}</Heading>
        </td>
      </tr>
    </table>

    <Heading as="h1">{update.title}</Heading>
    <RichText content={update.body} />
  </EmailLayout>
);

export default CompanyUpdatePublished;
