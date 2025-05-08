import React from "react";
import ComboBox from "../apps/next/components/ComboBox";
import { trpc } from "../apps/next/trpc/client";
import { useCurrentCompany } from "../apps/next/global";

interface RoleComboBoxProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const RoleComboBox = ({ value, onChange, className }: RoleComboBoxProps) => {
  const company = useCurrentCompany();
  const [{ workers }] = trpc.contractors.list.useSuspenseQuery({ 
    companyId: company.id,
    excludeAlumni: true 
  });
  
  const uniqueRoles = Array.from(new Set(
    workers
      .filter(worker => worker.role) // Filter out any undefined/null roles
      .map(worker => worker.role)
  )).sort();
  
  const roleOptions = uniqueRoles.map(role => ({
    label: role as string,
    value: role as string
  }));

  return (
    <ComboBox
      value={value}
      onChange={onChange}
      options={roleOptions}
      placeholder="Select or type a role..."
      className={className}
    />
  );
};

export default RoleComboBox;
