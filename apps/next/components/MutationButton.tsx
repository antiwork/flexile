import { type UseMutationResult } from "@tanstack/react-query";
import React from "react";
import { Button } from "@/components/ui/button";
import { e } from "@/utils";

const MutationButton = <T extends unknown>({
  disabled = false,
  loadingText,
  successText,
  errorText,
  children,
  mutation,
  param,
  idleVariant,
  asChild = false,
  ...buttonProps
}: {
  disabled?: boolean;
  loadingText?: React.ReactNode;
  successText?: React.ReactNode;
  errorText?: React.ReactNode;
  mutation: UseMutationResult<unknown, unknown, T>;
  children: React.ReactNode;
  idleVariant?: React.ComponentProps<typeof Button>["variant"];
} & Omit<React.ComponentProps<typeof Button>, "variant" | "tw"> &
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type -- this is valid
  (T extends void ? { param?: T } : { param: T })) => {
  const success = mutation.isSuccess && successText;
  const error = mutation.isError && errorText;

  return (
    <Button
      disabled={mutation.isPending || !!success || !!error || disabled}
      variant={success ? "success" : error ? "critical" : idleVariant}
      {...buttonProps}
      asChild={asChild}
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- TS isn't smart enough for this
      onClick={e(() => mutation.mutate(param as T), "prevent")}
    >
      {mutation.isPending ? loadingText || children : success || error || children}
    </Button>
  );
};

export default MutationButton;
