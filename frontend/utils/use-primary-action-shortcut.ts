import * as React from "react";

export function usePrimaryActionShortcut(
  containerRef: React.RefObject<HTMLElement | null>,
  onTrigger: (event: KeyboardEvent) => void,
  enabled = true,
) {
  React.useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const isEnter = event.key === "Enter" || event.key === "NumpadEnter" || event.code === "NumpadEnter";
      if (!isEnter) return;
      if (!(event.metaKey || event.ctrlKey)) return;

      const container = containerRef.current;
      const target = event.target;
      if (!container || !(target instanceof HTMLElement)) return;
      if (!container.contains(target)) return;

      if (target.tagName.toLowerCase() === "select") return;

      event.preventDefault();
      event.stopPropagation();
      onTrigger(event);
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [containerRef, onTrigger, enabled]);
}
