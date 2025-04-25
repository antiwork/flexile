"use client";

import React, { useId } from "react";
import ComboBox from "@/components/ComboBox";
import { Label } from "@/components/ui/label";
import { useCurrentCompany } from "@/global";
import { trpc } from "@/trpc/client";

interface RoleSelectorProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

interface RoleOption {
  label: string;
  value: string;
}

export default function RoleSelector({ value, onChange }: RoleSelectorProps) {
  const uid = useId();
  const company = useCurrentCompany();
  const [roles] = trpc.roles.list.useSuspenseQuery({ companyId: company.id });
  
  const defaultOptions: RoleOption[] = [{ label: "No roles available", value: "placeholder" }];
  
  const options: RoleOption[] = Array.isArray(roles) && roles.length > 0
    ? roles.map((role: any) => ({
        label: typeof role.name === 'string' ? role.name : 'Unknown',
        value: typeof role.id === 'string' ? role.id : 'unknown'
      }))
    : defaultOptions;
  
  return (
    <div className="grid gap-2">
      <Label htmlFor={`role-${uid}`}>Role</Label>
      <ComboBox
        id={`role-${uid}`}
        value={value ?? ""}
        options={options}
        onChange={onChange}
        placeholder="Select a role"
      />
    </div>
  );
}
