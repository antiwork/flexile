import { utc } from "@date-fns/utc";
import { formatISO, parseISO } from "date-fns";
import { pluralize } from "@/utils/pluralize";

export const formatDuration = (minutes: number) =>
  `${Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0")}:${(minutes % 60).toString().padStart(2, "0")}`;

/**
 * Near-term dates where the year is obvious or irrelevant (e.g. time tracking): Jan 3.
 *
 * If it signals an event (e.g. a payment is due), include the weekday: Wed Jan 3.
 */
export const formatDayOfMonth = (date: Date | string, options?: { weekday?: boolean }) =>
  formatDateTime(date, {
    month: "short",
    day: "numeric",
    weekday: options?.weekday ? "short" : undefined,
  });

export const formatServerDate = (date: Date) => formatISO(date, { representation: "date", in: utc });

export const formatMonth = (date: Date | string) => formatDateTime(date, { month: "short", year: "numeric" });

/**
 * All other dates: Jan 3, 2024
 *
 * For dates viewable by 2 or more actors (e.g. contract start or end dates),
 * the server should send a raw date string to ignore timezones (e.g "2024-01-03").
 * On the client, we convert it to UTC to avoid timezone issues.
 */
export const formatDate = (date: Date | string, options?: { time?: boolean }) => {
  if (options?.time) {
    // When time is requested, preserve time information. Treat Date as UTC to avoid client TZ drift.
    return formatDateTime(typeof date === "string" ? parseISO(date) : utc(date), {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  // For date-only display, normalize to a YYYY-MM-DD string in UTC and then format as local date.
  const normalizedDateOnly = formatServerDate(typeof date === "string" ? parseISO(date) : date);
  return formatDateTime(normalizedDateOnly, { dateStyle: "medium" });
};

const formatDateTime = (date: Date | string, options: Intl.DateTimeFormatOptions = {}) =>
  new Intl.DateTimeFormat(undefined, options).format(typeof date === "string" ? parseISO(date) : date);

/**
 * Humanizes a number of months into a string with years and months.
 */
export const humanizeMonths = (months: number) => {
  if (months === 0) return pluralize("day", 0, true);

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;

  if (years === 0) return pluralize("month", remainingMonths, true);
  if (remainingMonths === 0) return pluralize("year", years, true);

  return `${pluralize("year", years, true)} ${pluralize("month", remainingMonths, true)}`;
};
