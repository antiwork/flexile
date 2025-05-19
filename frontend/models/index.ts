export const MAX_WORKING_HOURS_PER_WEEK = 35;
export const WORKING_WEEKS_PER_YEAR = 44;
export const DEFAULT_WORKING_HOURS_PER_WEEK = 20;
export const MAX_EQUITY_PERCENTAGE = 100;
export const MAX_PREFERRED_NAME_LENGTH = 50; // Must match User::MAX_PREFERRED_NAME_LENGTH in Rails
export const MIN_EMAIL_LENGTH = 5; // Must match User::MIN_EMAIL_LENGTH in Rails
export const MAX_FILES_PER_CAP_TABLE_UPLOAD = 4;
export const MINIMUM_EQUITY_PERCENTAGE = 0;
export const MAXIMUM_EQUITY_PERCENTAGE = 100;

export const usStates = [
  { name: "Alabama", code: "AL" },
  { name: "Alaska", code: "AK" },
  { name: "American Samoa", code: "AS" },
  { name: "Arizona", code: "AZ" },
  { name: "Arkansas", code: "AR" },
  { name: "California", code: "CA" },
  { name: "Colorado", code: "CO" },
  { name: "Connecticut", code: "CT" },
  { name: "Delaware", code: "DE" },
  { name: "Florida", code: "FL" },
  { name: "Georgia", code: "GA" },
  { name: "Guam", code: "GU" },
  { name: "Hawaii", code: "HI" },
  { name: "Idaho", code: "ID" },
  { name: "Illinois", code: "IL" },
  { name: "Indiana", code: "IN" },
  { name: "Iowa", code: "IA" },
  { name: "Kansas", code: "KS" },
  { name: "Kentucky", code: "KY" },
  { name: "Louisiana", code: "LA" },
  { name: "Maine", code: "ME" },
  { name: "Maryland", code: "MD" },
  { name: "Massachusetts", code: "MA" },
  { name: "Michigan", code: "MI" },
  { name: "Minnesota", code: "MN" },
  { name: "Mississippi", code: "MS" },
  { name: "Missouri", code: "MO" },
  { name: "Montana", code: "MT" },
  { name: "Nebraska", code: "NE" },
  { name: "Nevada", code: "NV" },
  { name: "New Hampshire", code: "NH" },
  { name: "New Jersey", code: "NJ" },
  { name: "New Mexico", code: "NM" },
  { name: "New York", code: "NY" },
  { name: "North Carolina", code: "NC" },
  { name: "North Dakota", code: "ND" },
  { name: "Northern Mariana Islands", code: "MP" },
  { name: "Ohio", code: "OH" },
  { name: "Oklahoma", code: "OK" },
  { name: "Oregon", code: "OR" },
  { name: "Pennsylvania", code: "PA" },
  { name: "Puerto Rico", code: "PR" },
  { name: "Rhode Island", code: "RI" },
  { name: "South Carolina", code: "SC" },
  { name: "South Dakota", code: "SD" },
  { name: "Tennessee", code: "TN" },
  { name: "Texas", code: "TX" },
  { name: "U.S. Outlying Islands", code: "UM" },
  { name: "U.S. Virgin Islands", code: "VI" },
  { name: "Utah", code: "UT" },
  { name: "Vermont", code: "VT" },
  { name: "Virginia", code: "VA" },
  { name: "Washington", code: "WA" },
  { name: "Washington DC", code: "DC" },
  { name: "West Virginia", code: "WV" },
  { name: "Wisconsin", code: "WI" },
  { name: "Wyoming", code: "WY" },
];

export const DEFAULT_VESTING_SCHEDULE_OPTIONS = [
  {
    name: "4-year with 1-year cliff (1/48th monthly after cliff)",
    totalVestingDurationMonths: 48,
    cliffDurationMonths: 12,
    vestingFrequencyMonths: 1,
  },
  {
    name: "4-year without cliff (1/48th monthly from start)",
    totalVestingDurationMonths: 48,
    cliffDurationMonths: 0,
    vestingFrequencyMonths: 1,
  },
];
