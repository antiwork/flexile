import { InformationCircleIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useMutation } from "@tanstack/react-query";
import { pick } from "lodash-es";
import { Fragment, useEffect, useState } from "react";
import Delta from "@/components/Delta";
import Input from "@/components/Input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import MutationButton from "@/components/MutationButton";
import NumberInput from "@/components/NumberInput";
import RadioButtons from "@/components/RadioButtons";
import Select from "@/components/Select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/Tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { PayRateType } from "@/db/enums";
import { useCurrentCompany } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import { pluralize } from "@/utils/pluralize";

type Role = RouterOutput["roles"]["list"][number] & {
  trialPayRateInSubunits?: number;
};

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
      capitalizedExpense: 50,
      expenseAccountId: null,
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
    excludeAlumni: true,
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
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{role.id ? "Edit role" : "New role"}</DialogTitle>
          </DialogHeader>
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
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="pay-rate">Rate</Label>
              <NumberInput
                id="pay-rate"
                value={role.payRateInSubunits / 100}
                onChange={(value) => updateRole({ payRateInSubunits: (value ?? 0) * 100 })}
                invalid={errors.includes("payRateInSubunits")}
                prefix="$"
                suffix={
                  role.payRateType === PayRateType.Hourly
                    ? "/ hour"
                    : role.payRateType === PayRateType.Salary
                      ? "/ year"
                      : ""
                }
              />
              {errors.includes("payRateInSubunits") && <div className="text-destructive text-sm">Rate is required</div>}
            </div>
          </div>

          {expenseAccounts.length > 0 ? (
            <div className="grid gap-2">
              <Label htmlFor="capitalized-expense">Capitalized R&D expense</Label>
              <NumberInput
                id="capitalized-expense"
                value={role.capitalizedExpense ?? 0}
                onChange={(value) => updateRole({ capitalizedExpense: value ?? 0 })}
                suffix="%"
              />
            </div>
          ) : null}

          {role.id && contractorsToUpdate.length > 0 ? (
            <>
              {!updateContractorRates && (
                <Alert>
                  <InformationCircleIcon />
                  <AlertDescription>
                    {contractorsToUpdate.length}{" "}
                    {contractorsToUpdate.length === 1 ? "contractor has a" : "contractors have"} different{" "}
                    {pluralize("rate", contractorsToUpdate.length)} that won't be updated.
                  </AlertDescription>
                </Alert>
              )}
              <Checkbox
                checked={updateContractorRates}
                onCheckedChange={(checked) => setUpdateContractorRates(checked === true)}
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
            <div className="grid gap-2">
              <Label htmlFor="trial-rate">Rate during trial period</Label>
              <NumberInput
                id="trial-rate"
                value={role.trialPayRateInSubunits / 100}
                onChange={(value) => updateRole({ trialPayRateInSubunits: (value ?? 0) * 100 })}
                prefix="$"
              />
            </div>
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

          <DialogFooter>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmingRateUpdate} onOpenChange={() => setConfirmingRateUpdate(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update contractor rates?</DialogTitle>
          </DialogHeader>
          <Card>
            <CardContent className="pt-6">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex-1 text-sm text-muted-foreground">Current rate</div>
                <div className="font-medium">
                  {formatMoneyFromCents(contractorsToUpdate[0]?.payRateInSubunits ?? 0)}
                  {role.payRateType === PayRateType.Hourly ? "/hour" : ""}
                </div>
              </div>
              <div className="mb-4 flex items-center gap-2">
                <div className="flex-1 text-sm text-muted-foreground">New rate</div>
                <div className="font-medium">
                  {formatMoneyFromCents(role.payRateInSubunits)}
                  {role.payRateType === PayRateType.Hourly ? "/hour" : ""}
                </div>
              </div>
              <Separator />
              <div className="mt-4 flex items-center gap-2">
                <div className="flex-1 text-sm text-muted-foreground">Contractors affected</div>
                <div className="font-medium">{contractorsToUpdate.length}</div>
              </div>
            </CardContent>
          </Card>
          <DialogFooter>
            <div className="flex w-full gap-3">
              <Button variant="outline" onClick={() => setConfirmingRateUpdate(false)}>
                Cancel
              </Button>
              <Button onClick={() => saveMutation.mutate()}>Update rates</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmingDelete} onOpenChange={() => setConfirmingDelete(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permanently delete role?</DialogTitle>
          </DialogHeader>
          <p>This action cannot be undone.</p>
          <DialogFooter>
            <div className="flex justify-end gap-4">
              <Button variant="outline" onClick={() => setConfirmingDelete(false)}>
                Cancel
              </Button>
              <Button variant="critical" onClick={() => deleteMutation.mutate({ companyId: company.id, id: role.id })}>
                Delete
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ManageModal;
