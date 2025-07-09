import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { ActionConfig, ActionContext } from "./types";

interface SelectionActionsProps<T> {
  selectedItems: T[];
  config: ActionConfig<T>;
  actionContext: ActionContext;
  onAction: (actionId: string, items: T[]) => void;
}

export function SelectionActions<T>({ selectedItems, config, actionContext, onAction }: SelectionActionsProps<T>) {
  const context = selectedItems.length > 1 ? "bulk" : "single";
  const targetItem = selectedItems.length === 1 ? selectedItems[0] : null;

  // Filter actions based on permissions, context, and showIn
  const availableActions = Object.entries(config.actions)
    .filter(
      ([_, action]) =>
        action.permissions.includes(actionContext.userRole) &&
        action.contexts.includes(context) &&
        (action.showIn || ["both"]).some((location) => location === "selection" || location === "both"),
    )
    .map(([key, action]) => ({
      key,
      ...action,
      available:
        selectedItems.length === 1 && targetItem
          ? action.conditions(targetItem, actionContext)
          : selectedItems.length > 1
            ? selectedItems.every((item) => action.conditions(item, actionContext))
            : false,
    }))
    .filter((action) => action.available);

  return (
    <>
      {availableActions.map((action) => {
        if (action.href && targetItem) {
          return (
            <Button
              key={action.key}
              variant={action.variant || "outline"}
              size={action.iconOnly ? "icon" : "small"}
              className={action.iconOnly ? "aspect-square px-2" : ""}
              asChild
            >
              <Link href={{ pathname: action.href(targetItem) }}>
                <action.icon className="size-4" />
                {!action.iconOnly && action.label}
              </Link>
            </Button>
          );
        }

        if (action.action) {
          return (
            <Button
              key={action.key}
              variant={action.variant || "outline"}
              size="small"
              onClick={() => action.action && onAction(action.action, selectedItems)}
              className={action.iconOnly ? "aspect-square px-2" : ""}
              aria-label={`${action.label} selected ${config.entityName}`}
            >
              <action.icon className="size-4" />
              {!action.iconOnly && action.label}
            </Button>
          );
        }

        return null;
      })}
    </>
  );
}
