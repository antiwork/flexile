import { Heading, Img, Link, Preview, Text } from "@react-email/components";
import React from "react";
import FinancialOverview from "@/app/updates/company/FinancialOverview";
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
  financialReports,
  logoUrl,
}: {
  company: Company;
  update: Update;
  senderName: string;
  financialReports: React.ComponentProps<typeof FinancialOverview>["financialReports"];
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
    {update.period && update.periodStartedOn ? (
      <FinancialOverview
        financialReports={financialReports}
        period={update.period}
        periodStartedOn={update.periodStartedOn}
      />
    ) : null}
    <Heading as="h1">{update.title}</Heading>
    <RichText content={update.body} />
    {update.videoUrl ? (
      <Link href={update.videoUrl} target="_blank">
        View video
      </Link>
    ) : null}
  </EmailLayout>
);

export default CompanyUpdatePublished;
