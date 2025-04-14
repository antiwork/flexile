import Bugsnag from "@bugsnag/js";
import { utc } from "@date-fns/utc";
import { ExclamationTriangleIcon } from "@heroicons/react/20/solid";
import { differenceInDays, format } from "date-fns";
import { List } from "immutable";
import debounce from "lodash-es/debounce";
import { CalendarClockIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import AbsencesModal from "@/app/updates/team/AbsencesModal";
import { Task, TaskInput } from "@/app/updates/team/Task";
import { Card } from "@/components/Card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useCurrentCompany } from "@/global";
import type { RouterInput, RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";

type Update = RouterOutput["teamUpdates"]["list"][number];
type Absence = RouterOutput["workerAbsences"]["list"][number];
type TeamMemberData = {
  contractor: RouterOutput["contractors"]["listForTeamUpdates"][number];
  update: Update | null;
  absences: Absence[];
  periodStartsOn: string;
  periodEndsOn: string;
  isAbsentEntireWeek: boolean;
};

export const formatAbsencesForUpdate = (
  update: { periodStartsOn: string; periodEndsOn: string },
  absences: { startsOn: string; endsOn: string }[],
): string => {
  if (!absences.length) return "";

  const periodStart = utc(update.periodStartsOn);
  const periodEnd = utc(update.periodEndsOn);
  const periodLongerThanOneWeek = differenceInDays(periodEnd, periodStart) > 7;
  const formatString = periodLongerThanOneWeek ? "EEE, MMM d" : "EEE";

  return absences
    .map((absence) => {
      let absenceStart = utc(absence.startsOn);
      let absenceEnd = utc(absence.endsOn);
      if (absenceStart.getTime() < periodStart.getTime()) {
        absenceStart = periodStart;
      }
      if (absenceEnd.getTime() > periodEnd.getTime()) {
        absenceEnd = periodEnd;
      }

      const start = format(absenceStart, formatString);
      const end = absenceStart.getTime() !== absenceEnd.getTime() ? `-${format(absenceEnd, formatString)}` : "";
      return `${start}${end}`;
    })
    .join(periodLongerThanOneWeek ? "; " : ", ");
};

const CompanyWorkerUpdate = ({ data, editable }: { data: TeamMemberData; editable: boolean }) =>
  editable ? <EditableCompanyWorkerUpdate data={data} /> : <ReadableCompanyWorkerUpdate data={data} />;

const ReadableCompanyWorkerUpdate = ({ data }: { data: TeamMemberData }) => {
  const updateAbsence = data.absences.length > 0 ? formatAbsencesForUpdate(data, data.absences) : null;

  return (
    <Card className="overflow-hidden p-6">
      {data.update?.tasks.length || updateAbsence ? (
        <ul className="grid gap-1">
          {updateAbsence ? (
            <li className="flex">
              <CalendarClockIcon className="mr-2 h-5 w-5 text-gray-600" />
              <i>Off {updateAbsence}</i>
            </li>
          ) : null}
          {data.update?.tasks.map((task) => <Task key={task.id} task={task} />)}
        </ul>
      ) : null}
    </Card>
  );
};

type InputTask = RouterInput["teamUpdates"]["set"]["tasks"][number];
type SavingErrorContext = { tasks: List<InputTask>; periodStartsOn: string };
const removeEmptyTasks = (tasks: List<InputTask>): InputTask[] => tasks.toArray().filter((task) => task.name !== "");
const newTask = (): InputTask => ({ id: null, name: "", completedAt: null, integrationRecord: null });

const EditableCompanyWorkerUpdate = ({ data }: { data: TeamMemberData }) => {
  const [showAbsencesModal, setShowAbsencesModal] = useState(false);
  const [savingError, setSavingError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<List<InputTask>>(List());
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const utils = trpc.useUtils();
  const company = useCurrentCompany();
  const { update, absences, periodStartsOn, periodEndsOn } = data;
  const absenceSummary =
    absences.length > 0 ? formatAbsencesForUpdate({ periodStartsOn, periodEndsOn }, absences) : null;

  const handleSavingError = (errorContext: SavingErrorContext) => {
    setSavingError("Failed to save update. Please reload the page and try again.");
    Bugsnag.notify("error saving team update", (event) => {
      event.addMetadata("context", {
        tasks: errorContext.tasks.toArray(),
        periodStartsOn: errorContext.periodStartsOn,
      });
    });
  };

  const setUpdateMutation = trpc.teamUpdates.set.useMutation({
    onError: () => handleSavingError({ tasks, periodStartsOn }),
  });

  const debouncedSave = useCallback(
    debounce(async (tasks: List<InputTask>) => {
      await setUpdateMutation.mutateAsync({
        companyId: company.id,
        periodStartsOn,
        tasks: removeEmptyTasks(tasks),
      });
      void utils.teamUpdates.list.refetch();
    }, 500),
    [periodStartsOn],
  );

  const handleTaskUpdate = (updater: (tasks: List<InputTask>) => List<InputTask>) => {
    const updatedTasks = updater(tasks);
    const hasEmptyTask = updatedTasks.some((task) => !task.name);
    const nextTasks = hasEmptyTask ? updatedTasks : updatedTasks.push(newTask());
    setTasks(nextTasks);
    void debouncedSave(nextTasks);
  };

  const addTask = (index: number) => {
    const emptyTaskIndex = tasks.findIndex((task) => !task.name);
    if (emptyTaskIndex !== -1) return setFocusedIndex(emptyTaskIndex);

    handleTaskUpdate((tasks) => tasks.insert(index + 1, newTask()));
    setFocusedIndex(index + 1);
  };

  const removeTask = (index: number) => {
    if (tasks.size === 1) return;
    handleTaskUpdate((tasks) => tasks.delete(index));
    setFocusedIndex(Math.max(0, index - 1));
  };

  useEffect(() => {
    setTasks(List([...(update?.tasks || []), newTask()]));
  }, [periodStartsOn]);

  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <Card className="space-y-4 p-6">
        <ul className="mt-3 grid gap-1">
          {absenceSummary ? (
            <li className="flex">
              <CalendarClockIcon className="mr-2 h-5 w-5 text-gray-600" />
              <i>Off {absenceSummary}</i>
            </li>
          ) : null}
          {tasks.map((task, index) => (
            <TaskInput
              key={task.id ?? `tmp-${index}`}
              task={task}
              focused={focusedIndex === index}
              onClick={() => setFocusedIndex(index)}
              onEnter={() => addTask(index)}
              onChange={(task) => handleTaskUpdate((tasks) => tasks.set(index, task))}
              onSelectIntegrationRecord={(record) => {
                setFocusedIndex(index + 1);
                handleTaskUpdate((tasks) =>
                  tasks.set(index, {
                    ...task,
                    name: `#${record.resource_id}`,
                    integrationRecord: { ...record, id: null },
                    completedAt: record.resource_name === "pulls" && record.status === "merged" ? new Date() : null,
                  }),
                );
              }}
              onRemove={() => removeTask(index)}
            />
          ))}
        </ul>

        <footer className="grid gap-4 pt-4">
          <Button variant="link" onClick={() => setShowAbsencesModal(true)}>
            <CalendarClockIcon className="mr-2 h-5 w-5 text-gray-600" />
            Log time off
          </Button>
          {savingError ? (
            <Alert variant="destructive">
              <ExclamationTriangleIcon />
              <AlertDescription>{savingError}</AlertDescription>
            </Alert>
          ) : null}
        </footer>
      </Card>
      <AbsencesModal
        open={showAbsencesModal}
        onClose={() => {
          void utils.workerAbsences.list.refetch();
          setShowAbsencesModal(false);
        }}
      />
    </form>
  );
};

export default CompanyWorkerUpdate;
