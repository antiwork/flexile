import * as React from "react";
export function useModalKeyboardShortcut(onPrimaryAction: () => void, enabled = true) {
  React.useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target && target instanceof HTMLElement && target.matches("input, select")) return;

      const isMac = /(Mac|iPhone|iPod|iPad)/iu.test(navigator.userAgent);
      const isShortcutPressed = isMac ? event.metaKey : event.ctrlKey;

      if (event.key === "Enter" && isShortcutPressed) {
        event.preventDefault();
        event.stopPropagation();
        onPrimaryAction();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onPrimaryAction, enabled]);
}

export function getKeyboardShortcutHint(): string {
  const isMac = /(Mac|iPhone|iPod|iPad)/iu.test(navigator.userAgent);
  return isMac ? "⌘+Enter" : "Ctrl+Enter";
}
