import { ref, computed } from "vue";
import type { DeckSummary } from "../../shared/types/deck.js";

export type SyncPhase = "connect" | "pick" | "result";
export type SyncStrategy = "skip" | "overwrite" | "duplicate";

export interface SyncImportResult {
  imported: string[];
  skipped: string[];
  overwritten: string[];
  errors: { deckId: string; message: string }[];
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const err = (await res.json()) as { error?: string };
      if (err?.error) message = err.error;
    } catch {}
    throw new Error(message);
  }
  return (await res.json()) as T;
}

/**
 * State machine for the admin "Sync decks from another server" wizard:
 * connect -> pick -> result. Owns the credentials (reused for both the list and
 * import calls), the remote deck list + selection, and the import result.
 * Per-call instance — one sync panel is open at a time. The api-touching steps
 * (handleConnect/handleImport) are covered by e2e; the synchronous selection and
 * phase logic is unit-tested directly off this composable.
 */
export function useSyncDecks() {
  const phase = ref<SyncPhase>("connect");

  const url = ref("");
  const email = ref("");
  const password = ref("");

  const connecting = ref(false);
  const connectError = ref<string | null>(null);

  const remoteDecks = ref<DeckSummary[]>([]);
  const selected = ref<Set<string>>(new Set());
  const strategy = ref<SyncStrategy>("skip");
  const importing = ref(false);
  const importError = ref<string | null>(null);
  const result = ref<SyncImportResult | null>(null);

  const allSelected = computed(
    () => remoteDecks.value.length > 0 && remoteDecks.value.every((d) => selected.value.has(d.id)),
  );

  async function handleConnect() {
    if (!url.value.trim() || !email.value.trim() || !password.value) return;
    connecting.value = true;
    connectError.value = null;
    try {
      const data = await postJson<{ decks: DeckSummary[]; url: string }>("/api/admin/sync/list", {
        url: url.value,
        email: email.value,
        password: password.value,
      });
      remoteDecks.value = data.decks;
      url.value = data.url;
      selected.value = new Set();
      phase.value = "pick";
    } catch (e) {
      connectError.value = e instanceof Error ? e.message : String(e);
    }
    connecting.value = false;
  }

  function toggle(id: string) {
    const next = new Set(selected.value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selected.value = next;
  }

  function selectAll() {
    selected.value = new Set(remoteDecks.value.map((d) => d.id));
  }

  function selectNone() {
    selected.value = new Set();
  }

  async function handleImport() {
    if (selected.value.size === 0) return;
    importing.value = true;
    importError.value = null;
    try {
      const data = await postJson<SyncImportResult>("/api/admin/sync/import", {
        url: url.value,
        email: email.value,
        password: password.value,
        deckIds: [...selected.value],
        strategy: strategy.value,
      });
      result.value = data;
      phase.value = "result";
    } catch (e) {
      importError.value = e instanceof Error ? e.message : String(e);
    }
    importing.value = false;
  }

  function backToConnect() {
    phase.value = "connect";
    password.value = "";
    remoteDecks.value = [];
    selected.value = new Set();
  }

  function syncMore() {
    phase.value = "pick";
    result.value = null;
  }

  function deckName(id: string): string {
    return remoteDecks.value.find((d) => d.id === id)?.name ?? id;
  }

  return {
    phase,
    url,
    email,
    password,
    connecting,
    connectError,
    remoteDecks,
    selected,
    strategy,
    importing,
    importError,
    result,
    allSelected,
    handleConnect,
    toggle,
    selectAll,
    selectNone,
    handleImport,
    backToConnect,
    syncMore,
    deckName,
  };
}
