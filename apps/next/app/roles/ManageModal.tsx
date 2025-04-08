import { TrashIcon } from "@heroicons/react/24/outline";
import { useMutation } from "@tanstack/react-query";
import { pick } from "lodash-es";
import { useEffect, useState } from "react";
import Button from "@/components/Button";
import { Card, CardRow } from "@/components/Card";
import Checkbox from "@/components/Checkbox";
import Delta from "@/components/Delta";
import Input from "@/components/Input";
import Modal from "@/components/Modal";
import MutationButton from "@/components/MutationButton";
import Notice from "@/components/Notice";
import NumberInput from "@/components/NumberInput";
import RadioButtons from "@/components/RadioButtons";
import { Editor as RichTextEditor } from "@/components/RichText";
import Select from "@/components/Select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/Tooltip";
import { Switch } from "@/components/ui/switch";
import { PayRateType } from "@/db/enums";
import { useCurrentCompany } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import { pluralize } from "@/utils/pluralize";

type Role = RouterOutput["roles"]["list"][number];

const ManageModal = ({
  open,
  onClose,
  id,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  id: string | null;
  onCreated?: (id: string) => void;
}) => {
  const company = useCurrentCompany();
  const trpcUtils = trpc.useUtils();

  const [roles] = trpc.roles.list.useSuspenseQuery({ companyId: company.id });
  const getSelectedRole = () => {
    const role = roles.find((role) => role.id === id);
    if (role) return role;
    const defaults = {
      id: "",
      name: "",
      payRateInSubunits: 0,
      payRateType: PayRateType.Hourly,
      trialEnabled: false,
      trialPayRateInSubunits: 0,
      applicationCount: 0,
      activelyHiring: false,
      jobDescription: "",
      capitalizedExpense: 50,
      expenseAccountId: null,
      expenseCardEnabled: false,
      expenseCardSpendingLimitCents: 0n,
      expenseCardsCount: 0,
    };
    const lastRole = roles[0];
    return lastRole
      ? { ...defaults, ...pick(lastRole, "payRateInSubunits", "trialPayRateInSubunits", "capitalizedExpense") }
      : defaults;
  };
  const [role, setRole] = useState(getSelectedRole);
  useEffect(() => setRole(getSelectedRole()), [id]);
  const [updateContractorRates, setUpdateContractorRates] = useState(false);
  const [confirmingRateUpdate, setConfirmingRateUpdate] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [quickbooks] = trpc.quickbooks.get.useSuspenseQuery({ companyId: company.id });
  const expenseAccounts = quickbooks?.expenseAccounts ?? [];
  const [{ workers: contractors }, { refetch: refetchContractors }] = trpc.contractors.list.useSuspenseQuery({
    companyId: company.id,
    roleId: role.id,
    type: "not_alumni",
  });
  const deleteMutation = trpc.roles.delete.useMutation({
    onSuccess: async () => {
      await trpcUtils.roles.list.invalidate();
      setConfirmingDelete(false);
      onClose();
    },
  });
  const updateRole = (update: Partial<Role>) => setRole((prev) => ({ ...prev, ...update }));

  useEffect(() => {
    if (!role.id) setRole((prev) => ({ ...prev, trialPayRateInSubunits: Math.floor(prev.payRateInSubunits / 2) }));
  }, [role.payRateInSubunits, role.id]);

  const onSave = () => {
    if (contractorsToUpdate.length > 0 && updateContractorRates && role.id) {
      setConfirmingRateUpdate(true);
    } else {
      saveMutation.mutate();
    }
  };

  const contractorsToUpdate = contractors.filter(
    (contractor) => contractor.payRateInSubunits !== role.payRateInSubunits,
  );
  const canDelete = contractors.length === 0;
  const validatedFields = ["name", "payRateInSubunits"] as const;
  for (const field of validatedFields)
    useEffect(() => setErrors((prev) => prev.filter((f) => f !== field)), [role[field]]);

  const createRoleMutation = trpc.roles.create.useMutation();
  const updateRoleMutation = trpc.roles.update.useMutation();
  const updateContractorMutation = trpc.contractors.update.useMutation();
  const saveMutation = useMutation({
    mutationFn: async () => {
      const errors = validatedFields.filter((field) => !role[field]);
      if (errors.length > 0) {
        setErrors(errors);
        throw new Error("Validation error");
      }
      setConfirmingRateUpdate(false);
      const params = { companyId: company.id, ...role };

      if (role.id) {
        await updateRoleMutation.mutateAsync(params);
        if (updateContractorRates) {
          await Promise.all(
            contractorsToUpdate.map((contractor) =>
              updateContractorMutation.mutateAsync({
                companyId: company.id,
                id: contractor.id,
                payRateInSubunits: role.payRateInSubunits,
              }),
            ),
          );
          await refetchContractors();
        }
      } else {
        const id = await createRoleMutation.mutateAsync(params);
        setRole((prev) => ({ ...prev, id }));
        return id;
      }
    },
    onSuccess: async (id) => {
      await trpcUtils.roles.list.invalidate({ companyId: company.id });
      if (id) onCreated?.(id);
      onClose();
    },
  });

  return (
    <>
      <Modal open={open} onClose={onClose} title={role.id ? "Edit role" : "New role"}>
        <Input
          value={role.name}
          onChange={(name) => updateRole({ name })}
          label="Name"
          invalid={errors.includes("name")}
        />
        <RadioButtons
          value={role.payRateType}
          onChange={(payRateType) => updateRole({ payRateType })}
          label="Type"
          options={[
            { label: "Hourly", value: PayRateType.Hourly } as const,
            { label: "Project-based", value: PayRateType.ProjectBased } as const,
            company.flags.includes("salary_roles") ? ({ label: "Salary", value: PayRateType.Salary } as const) : null,
          ].filter((option) => !!option)}
          disabled={!!role.id}
        />
        <div className={`grid gap-3 ${expenseAccounts.length > 0 ? "md:grid-cols-2" : ""}`}>
          <NumberInput
            value={role.payRateInSubunits / 100}
            onChange={(value) => updateRole({ payRateInSubunits: (value ?? 0) * 100 })}
            invalid={errors.includes("payRateInSubunits")}
            label="Rate"
            prefix="$"
            suffix={
              role.payRateType === PayRateType.Hourly
                ? "/ hour"
                : role.payRateType === PayRateType.Salary
                  ? "/ year"
                  : undefined
            }
          />
          {expenseAccounts.length > 0 && (
            <NumberInput
              value={role.capitalizedExpense ?? 0}
              onChange={(value) => updateRole({ capitalizedExpense: value ?? 0 })}
              label="Capitalized R&D expense"
              suffix="%"
            />
          )}
        </div>
        {role.id && contractorsToUpdate.length > 0 ? (
          <>
            {!updateContractorRates && (
              <Notice>
                {contractorsToUpdate.length}{" "}
                {contractorsToUpdate.length === 1 ? "contractor has a" : "contractors have"} different{" "}
                {pluralize("rate", contractorsToUpdate.length)} that won't be updated.
              </Notice>
            )}
            <Checkbox
              checked={updateContractorRates}
              onChange={setUpdateContractorRates}
              label="Update rate for all contractors with this role"
            />
          </>
        ) : null}
        {role.id && role.payRateType === PayRateType.Hourly ? (
          <Switch
            checked={role.trialEnabled}
            onCheckedChange={(trialEnabled) => updateRole({ trialEnabled })}
            label="Start with trial period"
          />
        ) : null}
        {role.id && role.trialEnabled ? (
          <NumberInput
            value={role.trialPayRateInSubunits / 100}
            onChange={(value) => updateRole({ trialPayRateInSubunits: (value ?? 0) * 100 })}
            label="Rate during trial period"
            prefix="$"
          />
        ) : null}
        {role.id ? (
          <Switch
            checked={role.expenseCardEnabled}
            onCheckedChange={(expenseCardEnabled) => updateRole({ expenseCardEnabled })}
            label="Role should get expense card"
          />
        ) : null}
        {role.id && role.expenseCardEnabled ? (
          <NumberInput
            value={Number(role.expenseCardSpendingLimitCents) / 100}
            onChange={(value) => updateRole({ expenseCardSpendingLimitCents: BigInt((value ?? 0) * 100) })}
            invalid={errors.includes("expenseCardSpendingLimitCents")}
            label="Limit"
            prefix="$"
            suffix="/ month"
          />
        ) : null}
        {role.id && !role.expenseCardEnabled && role.expenseCardsCount > 0 ? (
          <Notice variant="critical">{role.expenseCardsCount} issued cards will no longer be usable.</Notice>
        ) : null}
        {role.id ? (
          <RichTextEditor
            value={role.jobDescription}
            onChange={(jobDescription) => updateRole({ jobDescription })}
            label="Job description"
          />
        ) : null}
        {expenseAccounts.length > 0 ? (
          <Select
            value={role.expenseAccountId ?? ""}
            onChange={(expenseAccountId) => updateRole({ expenseAccountId })}
            options={[
              { value: "", label: "Default" },
              ...expenseAccounts.map(({ id, name }) => ({ value: id, label: name })),
            ]}
            label="Expense account"
          />
        ) : null}
        {role.id ? (
          <Switch
            checked={role.activelyHiring}
            onCheckedChange={(activelyHiring) => updateRole({ activelyHiring })}
            label="Accepting candidates"
          />
        ) : null}
        <div className="flex w-full gap-3">
          <Button className="flex-1" onClick={onSave}>
            {role.id ? "Save changes" : "Create"}
          </Button>
          {role.id ? (
            <Tooltip>
              <TooltipTrigger asChild={canDelete}>
                <Button
                  variant="critical"
                  aria-label="Delete role"
                  disabled={!canDelete}
                  onClick={() => setConfirmingDelete(true)}
                >
                  <TrashIcon className="size-5" />
                </Button>
              </TooltipTrigger>
              {!canDelete ? <TooltipContent>You can't delete roles with active contractors</TooltipContent> : null}
            </Tooltip>
          ) : null}
        </div>
      </Modal>
      <Modal
        open={confirmingRateUpdate}
        onClose={() => setConfirmingRateUpdate(false)}
        title={`Update rates for ${contractorsToUpdate.length} ${pluralize("contractor", contractorsToUpdate.length)} to match role rate?`}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmingRateUpdate(false)}>
              Cancel
            </Button>
            <MutationButton mutation={saveMutation}>Yes, change</MutationButton>
          </>
        }
      >
        <div>Rate changes will apply to future invoices.</div>
        <Card>
          {contractorsToUpdate.map((contractor, i) => (
            <CardRow key={i} className="flex justify-between gap-2">
              <b>{contractor.user.name}</b>
              <div>
                <del>{formatMoneyFromCents(contractor.payRateInSubunits)}</del>{" "}
                {formatMoneyFromCents(role.payRateInSubunits)}{" "}
                <span>
                  (<Delta diff={role.payRateInSubunits / contractor.payRateInSubunits - 1} />)
                </span>
              </div>
            </CardRow>
          ))}
        </Card>
      </Modal>
      <Modal title="Permanently delete role?" open={confirmingDelete} onClose={() => setConfirmingDelete(false)}>
        {role.applicationCount ? <p>This will remove {role.applicationCount} candidates.</p> : null}
        <p>This action cannot be undone.</p>
        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={() => setConfirmingDelete(false)}>
            No, cancel
          </Button>
          <MutationButton mutation={deleteMutation} param={{ companyId: company.id, id: role.id }}>
            Yes, delete
          </MutationButton>
        </div>
      </Modal>
    </>
  );
};

export default ManageModal;
