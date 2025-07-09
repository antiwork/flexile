import React, { Fragment } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from "../ui/context-menu";
import type { ActionConfig, ActionContext } from "./types";

interface ContextMenuActionsProps<T> {
  item: T;
  selectedItems: T[];
  config: ActionConfig<T>;
  actionContext: ActionContext;
  onAction: (actionId: string, items: T[]) => void;
  onClearSelection?: () => void;
}

export function ContextMenuActions<T>({
  item,
  selectedItems,
  config,
  actionContext,
  onAction,
  onClearSelection,
}: ContextMenuActionsProps<T>) {
  const isItemSelected = selectedItems.some((selectedItem) => selectedItem === item);
  const hasSelection = selectedItems.length > 0;
  const targetItems = isItemSelected ? selectedItems : [item];
  const context = targetItems.length > 1 ? "bulk" : "single";

  if (!isItemSelected && hasSelection && onClearSelection) {
    return (
      <ContextMenuContent>
        <ContextMenuItem onClick={onClearSelection}>
          <X className="size-4" />
          Clear selection (Esc)
        </ContextMenuItem>
      </ContextMenuContent>
    );
  }

  const availableActions = Object.entries(config.actions)
    .filter(
      ([_, action]) =>
        action.permissions.includes(actionContext.userRole) &&
        action.contexts.includes(context) &&
        (action.showIn || ["both"]).some((location) => location === "contextMenu" || location === "both"),
    )
    .map(([key, action]) => ({
      key,
      ...action,
      available: targetItems.every((targetItem) => action.conditions(targetItem, actionContext)),
    }))
    .filter((action) => action.available);

  // Group actions by their group property
  const groupedActions = (config.contextMenuGroups || ["default"])
    .map((groupName) => ({
      groupName,
      actions: availableActions.filter((action) => (action.group || "default") === groupName),
    }))
    .filter((group) => group.actions.length > 0);

  if (groupedActions.length === 0) {
    return (
      <ContextMenuContent>
        <ContextMenuItem disabled>No actions available</ContextMenuItem>
      </ContextMenuContent>
    );
  }

  return (
    <ContextMenuContent>
      {groupedActions.map((group, groupIndex) => (
        <Fragment key={group.groupName}>
          {groupIndex > 0 && <ContextMenuSeparator />}
          {group.actions.map((action) => {
            if (action.href && targetItems.length === 1 && targetItems[0]) {
              return (
                <ContextMenuItem key={action.key} asChild>
                  <Link href={{ pathname: action.href(targetItems[0]) }}>
                    <action.icon className="size-4" />
                    {action.label}
                  </Link>
                </ContextMenuItem>
              );
            }

            if (action.action) {
              return (
                <ContextMenuItem
                  key={action.key}
                  {...(action.variant === "destructive" && { variant: "destructive" })}
                  onClick={() => action.action && onAction(action.action, targetItems)}
                >
                  <action.icon className="size-4" />
                  <span>{action.label}</span>
                </ContextMenuItem>
              );
            }

            return null;
          })}
        </Fragment>
      ))}
    </ContextMenuContent>
  );
}
