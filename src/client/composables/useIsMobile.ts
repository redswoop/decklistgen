import { ref, readonly, onScopeDispose } from "vue";

export const MOBILE_BREAKPOINT = 768;

export function useIsMobile(breakpoint = MOBILE_BREAKPOINT) {
  const query = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
  const isMobile = ref(query.matches);

  function onChange(e: MediaQueryListEvent) {
    isMobile.value = e.matches;
  }

  query.addEventListener("change", onChange);
  onScopeDispose(() => query.removeEventListener("change", onChange));

  return readonly(isMobile);
}
