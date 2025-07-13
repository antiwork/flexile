import React, { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { MutationStatusButton } from "@/components/MutationButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, ChevronDown } from "lucide-react";
import { useCurrentCompany } from "@/global";
import { trpc } from "@/trpc/client";
import { fetchInvestorEmail, isInvestor } from "@/models/investor";
import type { UseMutationResult } from "@tanstack/react-query";
import { cn } from "@/utils";

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
    }
  }, [data]);

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

        <p className="mb-4 text-sm">
          Choose investors who should be allowed to place bids. Only selected investors will see and participate in this
          buyback.
        </p>

        <div className="mb-4 flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-3">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder="Search name or email"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 pl-9"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-9 w-full justify-between sm:w-48">
                <span>{shareClassFilter}</span>
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {allShareClasses.map((shareClass) => (
                <DropdownMenuItem key={shareClass} onSelect={() => setShareClassFilter(shareClass)}>
                  {shareClass}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mb-3 max-h-64 overflow-y-auto">
          <div className="flex items-center space-x-3 p-3">
            <Checkbox
              id="all-investors"
              checked={allSelected}
              onCheckedChange={handleAllToggle}
              className="data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600"
            />
            <label htmlFor="all-investors" className="text-sm font-medium">
              {allSelected ? "All" : selectedInvestors.size} investors selected
            </label>
          </div>
          <div>
            {filteredInvestors.map((investor) => (
              <div
                key={investor.id}
                className={cn(
                  "flex items-center justify-between border-t border-gray-200 p-3",
                  selectedInvestors.has(investor.id) && "bg-blue-50",
                )}
              >
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id={investor.id}
                    checked={selectedInvestors.has(investor.id)}
                    onCheckedChange={() => handleInvestorToggle(investor.id)}
                    className="h-4 w-4 data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600"
                  />
                  <label htmlFor={investor.id} className="cursor-pointer text-sm">
                    {investor.name}
                  </label>
                </div>
                <div className="text-sm text-gray-500">{fetchInvestorEmail(investor) || "No email"}</div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2">
          <Button variant="outline" onClick={onBack} className="w-full sm:w-24">
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
