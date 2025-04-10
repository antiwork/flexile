import { Link, Text } from "@react-email/components";
import React from "react";
import { companies, companyRoleApplications } from "@/db/schema";
import { countries } from "@/models/constants";
import { LinkButton, RichText } from "@/trpc/email";
import EmailLayout from "@/trpc/EmailLayout";
import { companyName } from "@/trpc/routes/companies";
import { formatMoney } from "@/utils/formatMoney";

const JobApplication = ({
  application,
  company,
  annualCompensation,
  host,
}: {
  application: typeof companyRoleApplications.$inferSelect;
  company: typeof companies.$inferSelect;
  annualCompensation: number;
  host: string;
}) => (
  <EmailLayout>
    <RichText content={application.description} />
    <div className="mt-4">
      <Text>
        <span className="text-gray-500">Country</span>
        <br />
        <strong>{countries.get(application.countryCode) || application.countryCode}</strong>
      </Text>

      {application.hoursPerWeek ? (
        <Text>
          <span className="text-gray-500">Availability</span>
          <br />
          <strong>
            {application.hoursPerWeek} hours / week, {application.weeksPerYear} weeks / year
          </strong>
        </Text>
      ) : null}

      {annualCompensation > 0 ? (
        <>
          <Text>
            <span className="text-gray-500">Annual compensation</span>
            <br />
            <strong>{formatMoney(annualCompensation)}</strong>
          </Text>

          {application.equityPercent > 0 && (
            <>
              <Text>
                <span className="text-gray-500">Equity split</span>
                <br />
                <strong>{application.equityPercent}%</strong>
              </Text>

              <Text>
                <span className="text-gray-500">Net compensation (in cash)</span>
                <br />
                <strong>{formatMoney(annualCompensation * (1 - application.equityPercent / 100))}</strong>
              </Text>
            </>
          )}
        </>
      ) : null}
    </div>

    <div className="mt-4">
      <LinkButton href={`https://${host}/people/new?application_id=${application.id}`}>
        Invite to {companyName(company)}
      </LinkButton>
    </div>

    <div className="mt-4">
      <Text>
        Reply to this email to contact{" "}
        <Link href={`https://${host}/role_applications/${application.id}`}>{application.name}</Link>.
      </Text>
    </div>
  </EmailLayout>
);

export default JobApplication;
