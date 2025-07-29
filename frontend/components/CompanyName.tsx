import Image from "next/image";
import Link from "next/link";
import React from "react";
import { useCurrentCompany } from "../global";
import defaultCompanyLogo from "../images/default-company-logo.svg";

export const CompanyName = () => {
  const company = useCurrentCompany();
  return (
    <>
      {company.name ? (
        <Link href="/settings" className="relative size-6">
          <Image src={company.logo_url || defaultCompanyLogo} fill className="rounded-sm" alt="" />
        </Link>
      ) : null}
      <div>
        <span className="line-clamp-1 text-sm font-bold" title={company.name ?? ""}>
          {company.name}
        </span>
      </div>
    </>
  );
};
