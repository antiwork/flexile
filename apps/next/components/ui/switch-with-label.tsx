import { Label } from "./label";
import { Switch } from "./switch";
import React from "react";

const SwitchWithLabel = ({
  id,
  checked,
  onCheckedChange,
  disabled = false,
  label,
}: {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
}) => (
  <div className="flex items-center space-x-2">
    <Label htmlFor={id} className="flex-1">
      {label}
    </Label>
    <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
  </div>
);

export { SwitchWithLabel };
