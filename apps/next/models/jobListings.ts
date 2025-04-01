import { HIRING_LOCATIONS, type LOCATION_TYPES } from "./constants";

export interface JOB_POSITION {
  title: string;
  href: string;
  location: LOCATION_TYPES;
  compensationFullTime: string;
  compensationHourly: string;
  equityFullTime: string;
  vestingPeriod?: string;
  equityHourly?: string;
}

export const JOB_POSITIONS: JOB_POSITION[] = [
  {
    title: "Senior software engineer",
    href: "/jobs/senior-software-engineer",
    location: HIRING_LOCATIONS.REMOTE,
    compensationFullTime: "$150K - $250K per year",
    compensationHourly: "$100 - $150 per hour",
    equityFullTime: "0.5% - 1.0%",
  },
  {
    title: "Design engineer",
    href: "/jobs/design-engineer",
    location: HIRING_LOCATIONS.IN_PERSON,
    compensationFullTime: "$130K - $200K per year",
    compensationHourly: "$80 - $120 per hour",
    equityFullTime: "0.3% - 0.7%",
  },
  {
    title: "Staff engineer",
    href: "/jobs/staff-engineer",
    location: HIRING_LOCATIONS.REMOTE,
    compensationFullTime: "$180K - $280K per year",
    compensationHourly: "$120 - $180 per hour",
    equityFullTime: "0.7% - 1.2%",
  },
  {
    title: "Senior product designer",
    href: "/jobs/senior-product-designer",
    location: HIRING_LOCATIONS.IN_PERSON,
    compensationFullTime: "$140K - $220K per year",
    compensationHourly: "$90 - $140 per hour",
    equityFullTime: "0.4% - 0.8%",
  },
];

export const DEFAULT_VESTING_PERIOD = "4 years";
export const DEFAULT_EQUITY_HOURLY_RANGE = "20% - 80%";
