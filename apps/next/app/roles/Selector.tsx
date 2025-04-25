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

export default function RoleSelector({ value, onChange }: RoleSelectorProps) {
  const uid = useId();
  const company = useCurrentCompany();
  const [roles] = trpc.roles.list.useSuspenseQuery({ companyId: company.id });
  
  return (
    <div className="grid gap-2">
      <Label htmlFor={`role-${uid}`}>Role</Label>
      <ComboBox
        id={`role-${uid}`}
        value={value ?? ""}
        options={roles.length > 0 
          ? roles.map(role => ({ label: role.name, value: role.id }))
          : [{ label: "No roles available", value: "placeholder" }]
        }
        onChange={onChange}
        placeholder="Select a role"
      />
    </div>
  );
}
