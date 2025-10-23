import * as React from "react";

/**
 * usePrimaryActionShortcut
 *
 * Attaches a scoped `keydown` listener to the provided container element.
 * Triggers `onTrigger` when the user presses Enter while holding either
 * Meta (⌘) or Ctrl. Events from <select> elements are ignored. Editable
 * targets (inputs, textareas, contentEditable) are allowed as long as a
 * modifier key is pressed. No action occurs without a modifier.
 */
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
      if (!(event.metaKey || event.ctrlKey)) return; // require modifier

      const container = containerRef.current;
      const target = event.target;
      if (!container || !(target instanceof HTMLElement)) return;
      if (!container.contains(target)) return; // only when event originated inside dialog

      if (target.tagName.toLowerCase() === "select") return; // ignore selects

      event.preventDefault();
      event.stopPropagation();
      onTrigger(event);
    };

    // Attach to document so portal re-renders can't drop the listener
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [containerRef, onTrigger, enabled]);
}
