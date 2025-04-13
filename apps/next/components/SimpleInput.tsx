import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type SimpleInputProps = React.ComponentPropsWithoutRef<typeof Input> & {
  label: React.ReactNode;
};

const SimpleInput = ({ label, ...props }: SimpleInputProps) => {
  const id = React.useId();
  return (
    <div className="*:not-first:mt-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...props} />
    </div>
  );
};

export default SimpleInput;
