import { useQueryClient } from "@tanstack/react-query";
import { ChevronsUpDown } from "lucide-react";
import Image from "next/image";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentCompany, useCurrentUser, useUserStore } from "@/global";
import defaultCompanyLogo from "@/images/default-company-logo.svg";
import { request } from "@/utils/request";
import { company_switch_path } from "@/utils/routes";

function CompanySwitcher() {
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const switchCompany = async (companyId: string) => {
    useUserStore.setState((state) => ({ ...state, pending: true }));
    try {
      await request({
        method: "POST",
        url: company_switch_path(companyId),
        accept: "json",
      });
      await queryClient.resetQueries({ queryKey: ["currentUser"] });
    } finally {
      useUserStore.setState((state) => ({ ...state, pending: false }));
    }
  };

  return user.companies.length > 1 ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex h-12 w-full items-center gap-3 overflow-hidden p-2 text-left text-base outline-hidden [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0"
          aria-label="Switch company"
        >
          <CompanyName />
          <ChevronsUpDown className="ml-auto" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="z-[60] w-(--radix-dropdown-menu-trigger-width)" align="start">
        {user.companies.map((company) => (
          <DropdownMenuItem
            key={company.id}
            onSelect={() => {
              if (user.currentCompanyId !== company.id) void switchCompany(company.id);
            }}
            className="flex items-center gap-2"
          >
            <Image src={company.logo_url || defaultCompanyLogo} width={20} height={20} className="rounded-xs" alt="" />
            <span className="line-clamp-1">{company.name}</span>
            {company.id === user.currentCompanyId && <div className="ml-auto size-2 rounded-full bg-blue-500"></div>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : (
    <div className="flex items-center gap-2 p-2">
      <CompanyName />
    </div>
  );
}

const CompanyName = () => {
  const company = useCurrentCompany();

  return company.name ? (
    <>
      <span className="relative size-6">
        <Image src={company.logo_url || defaultCompanyLogo} fill className="rounded-sm" alt="Company Logo" />
      </span>
      <div>
        <span className="line-clamp-1 text-sm font-bold" title={company.name}>
          {company.name}
        </span>
      </div>
    </>
  ) : null;
};

export default CompanySwitcher;
