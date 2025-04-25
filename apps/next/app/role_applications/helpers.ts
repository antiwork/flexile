export enum PayRateType {
  Hourly = 0,
  ProjectBased = 1,
  Salary = 2,
}

export const calculateAnnualCompensation = ({
  role,
  application,
}: {
  role: { payRateType: number; payRateInSubunits: number };
  application: { hoursPerWeek?: number; weeksPerYear?: number };
}) => {
  switch (role.payRateType) {
    case PayRateType.ProjectBased:
      return 0;
    case PayRateType.Salary:
      return role.payRateInSubunits / 100;
    case PayRateType.Hourly:
      return application.hoursPerWeek && application.weeksPerYear
        ? (role.payRateInSubunits / 100) * application.hoursPerWeek * application.weeksPerYear
        : 0;
    default:
      return 0;
  }
};
