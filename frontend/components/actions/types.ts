export interface ActionDefinition<T = unknown> {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  variant?: "default" | "destructive" | "primary";
  contexts: ("single" | "bulk")[];
  permissions: string[];
  conditions: (item: T, context: ActionContext) => boolean;
  href?: (item: T) => string;
  action?: string;
  group?: string;
  // Control where actions appear
  showIn?: ("selection" | "contextMenu" | "both")[]; // Default: ['both']
  iconOnly?: boolean; // If true, never show label in selection bar
}

export interface ActionContext {
  userRole: string;
  permissions: Record<string, boolean>;
}

export interface ActionConfig<T = unknown> {
  entityName: string;
  actions: Record<string, ActionDefinition<T>>;
  // NEW: Define group order for context menu separators
  contextMenuGroups?: string[];
}
