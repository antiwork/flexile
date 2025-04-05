"use client";
import { utc } from "@date-fns/utc";
import { ArrowLeftIcon, ArrowRightIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { addWeeks, differenceInWeeks, endOfWeek, startOfWeek, subWeeks } from "date-fns";
import { CalendarClockIcon, CircleAlertIcon } from "lucide-react";
import Link from "next/link";
import { parseAsString, useQueryState } from "nuqs";
import React, { useState } from "react";
import CompanyWorkerUpdate from "@/app/updates/team/CompanyWorkerUpdate";
import MainLayout from "@/components/layouts/Main";
import Placeholder from "@/components/Placeholder";
import { Button } from "@/components/ui/button";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { formatDateRange } from "@/models/period";
import { trpc } from "@/trpc/client";
import { formatDayOfMonth, formatServerDate } from "@/utils/time";

export default function CompanyContractorUpdates() {
  const user = useCurrentUser();
  const company = useCurrentCompany();
  const [startsOn] = useQueryState(
    "period",
    parseAsString.withDefault(formatServerDate(startOfWeek(new Date(), { in: utc }))),
  );
  const currentWeekStartsOn = utc(startsOn);
  const currentPeriodEndsOn = formatServerDate(endOfWeek(currentWeekStartsOn));
  const previousWeekStartsOn = formatServerDate(subWeeks(currentWeekStartsOn, 1));
  const nextWeekStartsOn = formatServerDate(addWeeks(currentWeekStartsOn, 1));
  const relativeWeeks = differenceInWeeks(currentWeekStartsOn, new Date());

  const [contractors] = trpc.contractors.listForTeamUpdates.useSuspenseQuery({ companyId: company.id });
  const [teamUpdates] = trpc.teamUpdates.list.useSuspenseQuery({
    companyId: company.id,
    period: [startsOn],
  });
  const [absences] = trpc.workerAbsences.list.useSuspenseQuery(
    {
      companyId: company.id,
      from: startsOn,
      to: currentPeriodEndsOn,
    },
    {
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  );
  const teamMembersData = contractors.map((contractor) => {
    const update = teamUpdates.find(
      (update) => update.companyContractorId === contractor.id && update.periodStartsOn === startsOn,
    );
    const currentAbsences = absences.filter(
      (absence) => absence.companyContractorId === contractor.id && absence.endsOn >= startsOn,
    );
    const isAbsentEntireWeek = currentAbsences.some(
      (absence) => absence.startsOn <= startsOn && currentPeriodEndsOn <= absence.endsOn,
    );

    return {
      contractor,
      update: update || null,
      absences: currentAbsences,
      periodStartsOn: startsOn,
      periodEndsOn: update?.periodEndsOn ?? currentPeriodEndsOn,
      isAbsentEntireWeek,
    };
  });

  const absentees = teamMembersData.filter((update) => update.absences.length > 0);
  const [showAbsenceDetails, setShowAbsenceDetails] = useState(false);
  const updateHasContent = (update: (typeof teamMembersData)[number]["update"]) => update && update.tasks.length > 0;
  const filteredTeamMembersData = teamMembersData.filter(
    (data) => data.contractor.user.id === user.id || updateHasContent(data.update),
  );
  const workersMissingUpdates = teamMembersData
    .filter((update) => !updateHasContent(update.update) && !update.isAbsentEntireWeek)
    .map((update) => update.contractor.user.name);

  const showAbsentees = absentees.length > 0;
  const showMissingUpdates =
    filteredTeamMembersData.some((data) => updateHasContent(data.update)) && workersMissingUpdates.length > 0;

  return (
    <MainLayout
      title={
        <div className="col-span-1 flex items-center gap-6">
          <Link href={{ query: { period: previousWeekStartsOn } }} aria-label="Previous period" className="mt-1">
            <ArrowLeftIcon className="size-4" />
          </Link>
          <Link href={{ query: { period: nextWeekStartsOn } }} aria-label="Next period" className="mt-1">
            <ArrowRightIcon className="size-4" />
          </Link>
          <h1 className="text-3xl font-bold">
            <span>{relativeWeeks === 0 ? "This week" : relativeWeeks === -1 ? "Last week" : "Week"}: </span>
            {formatDateRange({ startsOn, endsOn: currentPeriodEndsOn })}
          </h1>
        </div>
      }
      subheader={
        showMissingUpdates || showAbsentees ? (
          <div className="grid items-center">
            {showMissingUpdates ? (
              <div className="flex max-w-(--breakpoint-xl) items-center gap-2 px-3 py-3 md:px-16">
                <CircleAlertIcon className="size-5 shrink-0 text-gray-600" />
                <strong>Missing updates:</strong> {workersMissingUpdates.join(", ")}
              </div>
            ) : null}
            {showMissingUpdates && showAbsentees ? <hr /> : null}
            {showAbsentees ? (
              <div className="max-w-(--breakpoint-xl) px-3 py-3 md:px-16">
                <div className="flex items-center gap-2">
                  <CalendarClockIcon className="size-5 shrink-0 text-gray-600" />
                  <div>
                    <strong>Off this week:</strong>{" "}
                    {absentees.slice(0, 3).map((update, index) => (
                      <React.Fragment key={update.contractor.id}>
                        {index !== 0 ? (index === absentees.length - 1 ? " and " : ", ") : null}
                        <Button variant="link" onClick={() => setShowAbsenceDetails((prev) => !prev)} className="p-0">
                          {update.contractor.user.name}
                        </Button>
                      </React.Fragment>
                    ))}
                    {absentees.length > 3 && (
                      <>
                        {" "}
                        and{" "}
                        <Button variant="link" onClick={() => setShowAbsenceDetails((prev) => !prev)} className="p-0">
                          {absentees.length - 3} more
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {showAbsenceDetails ? (
                  <ul className="mt-4 space-y-4">
                    {absentees.map((update) => (
                      <li key={update.contractor.id} className="space-y-1">
                        <div className="font-semibold">{update.contractor.user.name}</div>
                        <ul className="text-gray-600">
                          {update.absences.map((absence) => (
                            <li key={absence.id}>{formatDateRange(absence, { includeWeekday: true })}</li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null
      }
    >
      {filteredTeamMembersData.map((teamMemberData) => {
        const teamMember = teamMemberData.contractor.user;
        const editable = teamMember.id === user.id;
        return (
          <div key={teamMemberData.update?.id ?? "new"} className="grid gap-x-5 gap-y-3 md:grid-cols-[25%_1fr]">
            <hgroup>
              <h2 className="text-xl font-bold">
                {user.activeRole === "administrator" ? (
                  <Link href={`/people/${teamMember.id}?tab=updates`}>{teamMember.name}</Link>
                ) : (
                  <span>{teamMember.name}</span>
                )}
              </h2>
              {teamMemberData.update?.publishedAt ? (
                <p className="text-gray-600">
                  Posted on {formatDayOfMonth(teamMemberData.update.publishedAt, { weekday: true })}
                </p>
              ) : null}
            </hgroup>

            <CompanyWorkerUpdate data={teamMemberData} editable={editable} />
          </div>
        );
      })}
      {filteredTeamMembersData.length === 0 ? (
        <Placeholder icon={CheckCircleIcon}>No team updates to display.</Placeholder>
      ) : null}
    </MainLayout>
  );
}
