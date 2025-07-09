"use client";

import { cn } from "@/utils/index";
import Image from "next/image";
import defaultCompanyLogo from "@/images/default-company-logo.svg";
import { useCurrentUser } from "@/global";
import { useCompanySwitcher } from "@/lib/useCompanySwitcher";

export interface CompanySwitcherProps {
  onCompanySelect?: (companyId: string) => void;
  className?: string;
  itemClassName?: string;
}

export function CompanySwitcherList({ onCompanySelect, className, itemClassName }: CompanySwitcherProps) {
  const user = useCurrentUser();
  const { switchCompany } = useCompanySwitcher();

  const handleCompanySelect = async (companyId: string) => {
    if (user.currentCompanyId !== companyId) {
      await switchCompany(companyId);
      onCompanySelect?.(companyId);
    }
  };

  return (
    <div className={cn("space-y-1", className)}>
      {user.companies.map((company) => {
        const isSelected = company.id === user.currentCompanyId;

        return (
          <button
            key={company.id}
            onClick={() => void handleCompanySelect(company.id)}
            className={cn(
              "hover:bg-accent flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors",
              isSelected && "bg-accent text-accent-foreground",
              itemClassName,
            )}
            aria-label={`Switch to ${company.name}`}
            aria-current={isSelected ? "true" : undefined}
          >
            <Image src={company.logo_url || defaultCompanyLogo} width={20} height={20} className="rounded-xs" alt="" />
            <span className="line-clamp-1 flex-1">{company.name}</span>
          </button>
        );
      })}
    </div>
  );
}

export function CompanySwitcherHeader() {
  const user = useCurrentUser();
  const company = user.companies.find((c) => c.id === user.currentCompanyId);

  if (!company) return null;

  return (
    <div className="flex items-center gap-2">
      <div className="relative size-6">
        <Image src={company.logo_url || defaultCompanyLogo} fill className="rounded-sm" alt={company.name ?? ""} />
      </div>
      <span className="line-clamp-1 text-sm font-bold" title={company.name ?? ""}>
        {company.name}
      </span>
    </div>
  );
}
