import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Input from "@/components/Input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import type { EQUITY_TYPES, LOCATION_TYPES } from "@/models/constants";
import { type INVITE_CONTRACTOR_FORM_STATE, ROLE_DATA_CONFIG, ROLES } from "@/models/inviteContractor";

export default function InviteContractorForm({ onClose }: { onClose?: () => void }) {
  const [formState, setFormState] = useState<INVITE_CONTRACTOR_FORM_STATE>({
    email: "",
    role: "",
    location: "remote",
    type: "full-time",
    compensation: {
      yearly: "",
      hourly: "",
    },
    startDate: "",
    equity: {
      type: "fixed",
      fixed: "",
      range: [20, 80],
    },
  });
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const isVendor = formState.role === "vendor";
  const isFullTime = formState.type === "full-time";

  // Update form field helper
  const updateForm = <K extends keyof INVITE_CONTRACTOR_FORM_STATE>(key: K, value: INVITE_CONTRACTOR_FORM_STATE[K]) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
  };

  // Update nested form field helper
  const updateNestedForm = <
    K extends keyof INVITE_CONTRACTOR_FORM_STATE,
    N extends keyof INVITE_CONTRACTOR_FORM_STATE[K],
  >(
    key: K,
    nestedKey: N,
    value: INVITE_CONTRACTOR_FORM_STATE[K][N],
  ) => {
    setFormState((prev) => {
      // Create a properly typed copy of the entire form state
      const newState = { ...prev };

      // Then work with the strongly-typed nested object
      if (key === "compensation" && (nestedKey === "yearly" || nestedKey === "hourly")) {
        newState.compensation = {
          ...newState.compensation,
          [nestedKey]: value,
        };
      } else if (key === "equity" && (nestedKey === "type" || nestedKey === "fixed" || nestedKey === "range")) {
        newState.equity = {
          ...newState.equity,
          [nestedKey]: value,
        };
      }

      return newState;
    });
  };

  // Set defaults when role changes
  useEffect(() => {
    if (formState.role && ROLE_DATA_CONFIG[formState.role]) {
      const roleDefaults = ROLE_DATA_CONFIG[formState.role];
      updateNestedForm("compensation", "yearly", roleDefaults?.defaultSalary.toString() ?? "");
      updateNestedForm("compensation", "hourly", roleDefaults?.defaultRate.toString() ?? "");
      updateNestedForm("equity", "fixed", roleDefaults?.defaultEquity.min.toString() ?? "");
      updateNestedForm("equity", "range", [roleDefaults?.defaultEquity.min ?? 0, roleDefaults?.defaultEquity.max ?? 0]);
    }
  }, [formState.role]);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setIsLoading(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const equityData =
      formState.equity.type === "fixed"
        ? { equityFixed: Number.parseFloat(formState.equity.fixed) }
        : { equityRange: { min: formState.equity.range[0], max: formState.equity.range[1] } };

    // TODO: Handle the response accordingly, remove console.log and remove eslint disable directive
    // eslint-disable-next-line no-console
    console.log("Contractor invited:", {
      email: formState.email,
      role: formState.role,
      ...(isVendor
        ? {}
        : {
            location: formState.location,
            type: formState.type,
            compensation: {
              type: isFullTime ? "salary" : "rate",
              amount: Number.parseFloat(isFullTime ? formState.compensation.yearly : formState.compensation.hourly),
            },
            startDate: formState.startDate,
          }),
      ...equityData,
    });

    setIsLoading(false);
    if (onClose) {
      onClose();
    }
    router.push("/contractors");
  };

  return (
    <div className="relative mx-auto max-w-md">
      {onClose ? (
        <button
          onClick={onClose}
          className="absolute top-0 right-0 p-2 text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
          <X className="h-6 w-6" />
        </button>
      ) : null}
      <h2 className="mb-6 text-left text-2xl font-bold text-gray-800">Invite Contractor</h2>
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <Input
          type="email"
          label="Email"
          value={formState.email}
          onChange={(value) => updateForm("email", value)}
          required
        />

        <div className="group grid gap-2">
          <label htmlFor="role" className="cursor-pointer">
            Role
          </label>
          <select
            id="role"
            value={formState.role}
            onChange={(e) => updateForm("role", e.target.value)}
            required
            className="rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">Select a role</option>
            {ROLES.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </div>

        {!isVendor && (
          <>
            <div className="flex space-x-4">
              <div className="w-1/2">
                <Label className="text-sm font-medium text-gray-700">Location</Label>
                <RadioGroup
                  value={formState.location}
                  onValueChange={(value: LOCATION_TYPES) => updateForm("location", value)}
                  className="mt-2 flex space-x-4"
                >
                  <div className="flex items-center space-x-2 text-nowrap">
                    <RadioGroupItem value="in-person" id="in-person" />
                    <Label htmlFor="in-person">In-person</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="remote" id="remote" />
                    <Label htmlFor="remote">Remote</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>

            <Input
              type="number"
              label="Salary ($/year)"
              value={formState.compensation.yearly}
              onChange={(value) => updateNestedForm("compensation", "yearly", value)}
              required
              placeholder="0.00"
              prefix="$"
              suffix="/year"
            />

            <Input
              type="number"
              label="Rate ($/hr)"
              value={formState.compensation.hourly}
              onChange={(value) => updateNestedForm("compensation", "hourly", value)}
              required
              placeholder="0.00"
              prefix="$"
              suffix="/hr"
            />

            <div>
              <Label className="text-sm font-medium text-gray-700">Equity Split</Label>
              <RadioGroup
                value={formState.equity.type}
                onValueChange={(value: EQUITY_TYPES) => updateNestedForm("equity", "type", value)}
                className="mt-2 flex space-x-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="fixed" id="equityFixed" />
                  <Label htmlFor="equityFixed">Fixed percentage</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="range" id="equityRange" />
                  <Label htmlFor="equityRange">Percentage range</Label>
                </div>
              </RadioGroup>

              {formState.equity.type === "fixed" ? (
                <Input
                  type="number"
                  value={formState.equity.fixed}
                  onChange={(value) => updateNestedForm("equity", "fixed", value)}
                  placeholder="Fixed equity percentage"
                  step="0.1"
                  suffix="%"
                  className="mt-2"
                />
              ) : (
                <div className="mt-4">
                  <Slider
                    defaultValue={[20, 80]}
                    max={100}
                    step={1}
                    value={formState.equity.range}
                    onValueChange={(value: [number, number]) => updateNestedForm("equity", "range", value)}
                    className="w-full"
                    minStepsBetweenThumbs={1}
                  />
                  <div className="mt-2 flex justify-between text-sm text-gray-600">
                    <span>{formState.equity.range[0].toFixed(1)}%</span>
                    <span>{formState.equity.range[1].toFixed(1)}%</span>
                  </div>
                </div>
              )}
            </div>

            <Input
              label="Start Date"
              value={formState.startDate}
              onChange={(value) => updateForm("startDate", value)}
              required
              placeholder="e.g., next Monday, in 2 weeks, July 1st"
            />
          </>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isLoading}
            className="rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50"
          >
            {isLoading ? "Sending invite..." : "Send invite"}
          </button>
        </div>
      </form>
    </div>
  );
}
