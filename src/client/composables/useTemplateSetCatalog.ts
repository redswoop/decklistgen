import { ref, computed } from "vue";

export interface TemplateSetCatalogEntry {
  id: string;
  name: string;
  origin: "builtin" | "user";
}

const entries = ref<TemplateSetCatalogEntry[]>([]);
const globalSetId = ref<string>("default");
const loaded = ref(false);
let inflight: Promise<void> | null = null;

async function fetchCatalog(): Promise<void> {
  if (loaded.value) return;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const [setsResp, policyResp] = await Promise.all([
        fetch("/gallery/editor/sets"),
        fetch("/gallery/editor/sets/policy"),
      ]);
      if (setsResp.ok) {
        const data = (await setsResp.json()) as Array<{ id: string; name: string; origin: "builtin" | "user" }>;
        entries.value = data.map((s) => ({ id: s.id, name: s.name, origin: s.origin }));
      }
      if (policyResp.ok) {
        const policy = (await policyResp.json()) as { globalSetId?: string };
        if (policy.globalSetId) globalSetId.value = policy.globalSetId;
      }
      loaded.value = true;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Force a re-fetch on next access (e.g. after the user forks/deletes a set). */
export function invalidateTemplateSetCatalog(): void {
  loaded.value = false;
}

export function useTemplateSetCatalog() {
  void fetchCatalog();

  const setLabel = (id: string | undefined): string => {
    if (!id) return "Default";
    const match = entries.value.find((e) => e.id === id);
    return match?.name ?? id;
  };

  const sortedEntries = computed(() => {
    const builtin = entries.value.filter((e) => e.origin === "builtin");
    const user = entries.value.filter((e) => e.origin === "user");
    return [...builtin, ...user];
  });

  return { entries: sortedEntries, globalSetId, loaded, setLabel, refresh: fetchCatalog };
}
