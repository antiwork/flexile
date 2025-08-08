import { type UseMutationResult } from "@tanstack/react-query";
import React from "react";
import { Button } from "@/components/ui/button";
import { e } from "@/utils";

export const MutationStatusButton = <T extends unknown>({
  disabled = false,
  loadingText,
  successText,
  errorText,
  children,
  mutation,
  idleVariant,
  ...buttonProps
}: {
  disabled?: boolean | undefined;
  loadingText?: React.ReactNode;
  successText?: React.ReactNode;
  errorText?: React.ReactNode;
  mutation: UseMutationResult<unknown, unknown, T>;
  children: React.ReactNode;
  idleVariant?: React.ComponentProps<typeof Button>["variant"];
} & Omit<React.ComponentProps<typeof Button>, "variant" | "tw">) => {
  const success = mutation.isSuccess && successText;
  const error = mutation.isError && errorText;

  return (
    <Button
      disabled={mutation.isPending || !!success || !!error || disabled}
      variant={success ? "success" : error ? "critical" : idleVariant}
      {...buttonProps}
    >
      {mutation.isPending ? loadingText || children : success || error || children}
    </Button>
  );
};

const MutationButton = <T extends unknown>({
  param,
  mutation,
  asChild = false,
  ...buttonProps
}: {} & React.ComponentProps<typeof MutationStatusButton<T>> &
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type -- this is valid
  (T extends void ? { param?: T } : { param: T })) => (
  <MutationStatusButton
    {...buttonProps}
    mutation={mutation}
    asChild={asChild}
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- TS isn't smart enough for this
    onClick={e(() => mutation.mutate(param as T), "prevent")}
  />
);

export default MutationButton;
