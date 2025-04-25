"use client";

import React, { useId } from "react";
import ComboBox from "@/components/ComboBox";
import { Label } from "@/components/ui/label";

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
  
  const options: RoleOption[] = [{ label: "No roles available", value: "placeholder" }];
  
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
