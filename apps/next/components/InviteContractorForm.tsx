import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";

interface RoleData {
  defaultRate: number;
  defaultSalary: number;
  defaultEquity: { min: number; max: number };
}

const roleData: Record<string, RoleData> = {
  developer: { defaultRate: 100, defaultSalary: 120000, defaultEquity: { min: 20, max: 80 } },
  designer: { defaultRate: 90, defaultSalary: 110000, defaultEquity: { min: 20, max: 80 } },
  "project-manager": { defaultRate: 110, defaultSalary: 130000, defaultEquity: { min: 20, max: 80 } },
  consultant: { defaultRate: 150, defaultSalary: 160000, defaultEquity: { min: 20, max: 80 } },
  vendor: { defaultRate: 0, defaultSalary: 0, defaultEquity: { min: 0, max: 10 } },
};

export default function InviteContractorForm({ onClose }: { onClose?: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [location, setLocation] = useState("remote");
  const [type, setType] = useState("full-time");
  const [Yearlycompensation, setYearlyCompensation] = useState("");
  const [Hourlycompensation, setHourlyCompensation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [equityType, setEquityType] = useState<"fixed" | "range">("fixed");
  const [equityFixed, setEquityFixed] = useState("");
  const [equityRange, setEquityRange] = useState([20, 80]);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const isVendor = role === "vendor";
  const isFullTime = type === "full-time";

  useEffect(() => {
    if (role && roleData[role]) {
      setYearlyCompensation(
        isFullTime ? roleData[role].defaultSalary.toString() : roleData[role].defaultRate.toString(),
      );
      setHourlyCompensation(roleData[role].defaultRate.toString());
      setEquityFixed(roleData[role].defaultEquity.min.toString());
      setEquityRange([roleData[role].defaultEquity.min, roleData[role].defaultEquity.max]);
    }
  }, [role, isFullTime]);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setIsLoading(true);

    // TODO: Replace with actual API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const equityData =
      equityType === "fixed"
        ? { equityFixed: Number.parseFloat(equityFixed) }
        : { equityRange: { min: equityRange[0], max: equityRange[1] } };

    // TODO: Handle the response accordingly, remove console.log and remove eslint disable directive
    // eslint-disable-next-line no-console
    console.log("Contractor invited:", {
      email,
      role,
      ...(isVendor
        ? {}
        : {
            location,
            type,
            compensation: {
              type: isFullTime ? "salary" : "rate",
              amount: Number.parseFloat(isFullTime ? Yearlycompensation : Hourlycompensation),
            },
            startDate,
          }),
      ...equityData,
    });

    setIsLoading(false);
    // TODO: Show success message or redirect
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
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="role" className="block text-sm font-medium text-gray-700">
            Role
          </label>
          <select
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            required
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">Select a role</option>
            <option value="developer">Developer</option>
            <option value="designer">Designer</option>
            <option value="project-manager">Project Manager</option>
            <option value="consultant">Consultant</option>
            <option value="vendor">Vendor</option>
          </select>
        </div>
        {!isVendor && (
          <>
            <div className="flex space-x-4">
              <div className="w-1/2">
                <Label className="text-sm font-medium text-gray-700">Location</Label>
                <RadioGroup value={location} onValueChange={setLocation} className="mt-2 flex space-x-4">
                  <div className="flex items-center space-x-2">
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
            <div>
              <label htmlFor="compensation" className="block text-sm font-medium text-gray-700">
                Salary ($/year)
              </label>
              <div className="relative mt-1 rounded-md shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <span className="text-gray-500 sm:text-sm">$</span>
                </div>
                <input
                  type="number"
                  id="compensation"
                  value={Yearlycompensation}
                  onChange={(e) => setYearlyCompensation(e.target.value)}
                  required
                  className="block w-full rounded-md border border-gray-300 py-2 pr-12 pl-7 focus:border-blue-500 focus:ring-blue-500"
                  placeholder="0.00"
                  aria-describedby="compensation-currency"
                />
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                  <span className="text-gray-500 sm:text-sm" id="compensation-currency">
                    /year
                  </span>
                </div>
              </div>
              <div className="mt-2.5">
                <label htmlFor="hourlyCompensation" className="block text-sm font-medium text-gray-700">
                  Rate ($/hr)
                </label>
                <div className="relative mt-1 rounded-md shadow-sm">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <span className="text-gray-500 sm:text-sm">$</span>
                  </div>
                  <input
                    type="number"
                    id="hourlyCompensation"
                    value={Hourlycompensation}
                    onChange={(e) => setHourlyCompensation(e.target.value)}
                    required
                    className="block w-full rounded-md border border-gray-300 py-2 pr-12 pl-7 focus:border-blue-500 focus:ring-blue-500"
                    placeholder="0.00"
                    aria-describedby="hourly-compensation-currency"
                  />
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                    <span className="text-gray-500 sm:text-sm" id="hourly-compensation-currency">
                      /hr
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-700">Equity Split</Label>
              <RadioGroup
                value={equityType}
                onValueChange={(value: "fixed" | "range") => setEquityType(value)}
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
              {equityType === "fixed" ? (
                <div className="relative mt-2">
                  <input
                    type="number"
                    value={equityFixed}
                    onChange={(e) => setEquityFixed(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 pr-8 focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Fixed equity percentage"
                    step="0.1"
                  />
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                    <span className="text-gray-500 sm:text-sm">%</span>
                  </div>
                </div>
              ) : (
                <div className="mt-4">
                  <Slider
                    defaultValue={[20, 80]}
                    max={100}
                    step={1}
                    value={equityRange}
                    onValueChange={(value: [number, number]) => setEquityRange(value)}
                    className="w-full"
                    minStepsBetweenThumbs={1}
                  />
                  <div className="mt-2 flex justify-between text-sm text-gray-600">
                    <span>{equityRange[0]?.toFixed(1)}%</span>
                    <span>{equityRange[1]?.toFixed(1)}%</span>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">
                Start Date
              </label>
              <input
                type="text"
                id="startDate"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                placeholder="e.g., next Monday, in 2 weeks, July 1st"
              />
            </div>
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
