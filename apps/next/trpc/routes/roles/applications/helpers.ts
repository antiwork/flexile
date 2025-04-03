import { PayRateType } from "@/db/enums";
import type { companyRoleApplications, companyRoleRates } from "@/db/schema";

export const calculateAnnualCompensation = ({
  role,
  application,
}: {
  role: Pick<typeof companyRoleRates.$inferSelect, "payRateType" | "payRateInSubunits">;
  application: Pick<typeof companyRoleApplications.$inferSelect, "hoursPerWeek" | "weeksPerYear">;
}) => {
  if (!role.payRateInSubunits) return 0;

  switch (role.payRateType) {
    case PayRateType.ProjectBased:
      return 0;
    case PayRateType.Salary:
      return role.payRateInSubunits / 100;
    case PayRateType.Hourly:
      return application.hoursPerWeek && application.weeksPerYear
        ? (role.payRateInSubunits / 100) * application.hoursPerWeek * application.weeksPerYear
        : 0;
  }
};
