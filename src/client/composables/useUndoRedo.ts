import { onMounted, onUnmounted } from "vue";

/**
 * Global Cmd/Ctrl-Z (undo) and Cmd/Ctrl-Shift-Z (redo) keyboard shortcuts,
 * ignored while typing in a form field. Self-manages its document listener.
 */
export function useUndoRedo(undo: () => void, redo: () => void) {
  function handleUndoRedo(e: KeyboardEvent) {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
      e.preventDefault();
      undo();
    } else if ((e.metaKey || e.ctrlKey) && e.key === "z" && e.shiftKey) {
      e.preventDefault();
      redo();
    }
  }

  onMounted(() => document.addEventListener("keydown", handleUndoRedo));
  onUnmounted(() => document.removeEventListener("keydown", handleUndoRedo));
}
