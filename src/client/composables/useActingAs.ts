import { ref, computed } from "vue";
import { setActingAsHeader } from "../lib/client.js";
import type { AdminUser } from "../../shared/types/user.js";

/**
 * Admin "act as another user" state. When set, deck API calls carry an
 * X-Act-As-User header (wired into the api client) so the server scopes deck
 * reads/writes to the target user. In-memory only — a page reload reverts the
 * admin to their own decks (safe default).
 */
const actingAsUserId = ref<string | null>(null);
const actingAsUser = ref<AdminUser | null>(null);

export function useActingAs() {
  const isActingAs = computed(() => actingAsUserId.value !== null);

  function setActingAs(user: AdminUser): void {
    actingAsUserId.value = user.id;
    actingAsUser.value = user;
    setActingAsHeader(user.id);
  }

  function clearActingAs(): void {
    actingAsUserId.value = null;
    actingAsUser.value = null;
    setActingAsHeader(null);
  }

  return { actingAsUserId, actingAsUser, isActingAs, setActingAs, clearActingAs };
}
