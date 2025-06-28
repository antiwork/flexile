import React, { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { MutationStatusButton } from "@/components/MutationButton";
import { Search, ChevronDown } from "lucide-react";
import { useCurrentCompany } from "@/global";
import { trpc } from "@/trpc/client";
import { fetchInvestorEmail, isInvestor } from "@/models/investor";
import type { UseMutationResult } from "@tanstack/react-query";

type SelectInvestorsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onBack: () => void;
  onNext: (data: string[]) => void;
  mutation: UseMutationResult<unknown, unknown, void>;
  data?: string[];
};

const SelectInvestorsModal = ({ isOpen, onClose, onBack, onNext, mutation, data }: SelectInvestorsModalProps) => {
  const company = useCurrentCompany();
  const [searchTerm, setSearchTerm] = useState("");
  const [shareClassFilter, setShareClassFilter] = useState("All share classes");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedInvestors, setSelectedInvestors] = useState<Set<string>>(new Set());
  const [allSelected, setAllSelected] = useState(true);

  const [capTable] = trpc.capTable.show.useSuspenseQuery({ companyId: company.id });

  const investors = capTable.investors.filter((inv) => isInvestor(inv));
  const allShareClasses = ["All share classes", ...capTable.shareClasses.map((sc) => sc.name)];

  const filteredInvestors = useMemo(
    () =>
      investors.filter((investor) => {
        const matchesSearch =
          investor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          fetchInvestorEmail(investor)?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesShareClass = shareClassFilter === "All share classes";

        return matchesSearch && matchesShareClass;
      }),
    [investors, searchTerm, shareClassFilter],
  );

  useEffect(() => {
    if (data && data.length > 0) {
      setSelectedInvestors(new Set(data));
    } else if (investors.length > 0 && selectedInvestors.size === 0) {
      const allIds = new Set(investors.map((inv) => inv.id));
      setSelectedInvestors(allIds);
    }
  }, [investors, data, selectedInvestors.size]);

  useEffect(() => {
    setAllSelected(selectedInvestors.size === filteredInvestors.length && filteredInvestors.length > 0);
  }, [selectedInvestors.size, filteredInvestors.length]);

  const handleInvestorToggle = (investorId: string) => {
    const newSelected = new Set(selectedInvestors);
    if (newSelected.has(investorId)) {
      newSelected.delete(investorId);
    } else {
      newSelected.add(investorId);
    }
    setSelectedInvestors(newSelected);
  };

  const handleAllToggle = () => {
    if (allSelected) {
      setSelectedInvestors(new Set());
    } else {
      const allIds = new Set(filteredInvestors.map((inv) => inv.id));
      setSelectedInvestors(allIds);
    }
  };

  const handleNext = () => {
    onNext(Array.from(selectedInvestors));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Select who can join this buyback</DialogTitle>
        </DialogHeader>

        <p className="mb-4 text-sm text-gray-600">
          Choose investors who should be allowed to place bids. Only selected investors will see and participate in this
          buyback.
        </p>

        <div className="mb-4 flex space-x-3">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search name or email"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex w-48 items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <span>{shareClassFilter}</span>
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </button>
            {showDropdown ? (
              <div className="absolute top-full left-0 z-10 mt-1 w-48 rounded-md border border-gray-300 bg-white shadow-lg">
                {allShareClasses.map((shareClass) => (
                  <button
                    key={shareClass}
                    type="button"
                    onClick={() => {
                      setShareClassFilter(shareClass);
                      setShowDropdown(false);
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                  >
                    {shareClass}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mb-3">
          <div className="flex items-center space-x-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
            <Checkbox
              id="all-investors"
              checked={allSelected}
              onCheckedChange={handleAllToggle}
              className="data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600"
            />
            <label htmlFor="all-investors" className="text-sm font-medium text-blue-900">
              All investors selected
            </label>
          </div>
        </div>

        <div className="max-h-64 overflow-y-auto">
          <div className="space-y-1">
            {filteredInvestors.map((investor) => (
              <div
                key={investor.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3"
              >
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id={investor.id}
                    checked={selectedInvestors.has(investor.id)}
                    onCheckedChange={() => handleInvestorToggle(investor.id)}
                    className="data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600"
                  />
                  <label htmlFor={investor.id} className="cursor-pointer text-sm font-medium text-gray-900">
                    {investor.name}
                  </label>
                </div>
                <div className="text-sm text-gray-500">{fetchInvestorEmail(investor) || "No email"}</div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between sm:gap-0">
          <Button variant="outline" onClick={onBack} className="w-full sm:w-auto">
            Back
          </Button>
          <MutationStatusButton
            onClick={handleNext}
            mutation={mutation}
            className="w-full sm:w-auto"
            disabled={selectedInvestors.size === 0}
          >
            Create buyback
          </MutationStatusButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SelectInvestorsModal;
