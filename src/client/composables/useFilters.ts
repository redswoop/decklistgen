import { reactive, ref, watch } from "vue";
import type { CardFilters, SpecialAttribute } from "../../shared/types/filters.js";

const filters = reactive<CardFilters>({});
const page = ref(1);

// --- URL sync ---

function filtersToParams(): URLSearchParams {
  const p = new URLSearchParams();
  if (filters.sets?.length) p.set("sets", filters.sets.join(","));
  if (filters.era) p.set("era", filters.era);
  if (filters.category) p.set("cat", filters.category);
  if (filters.trainerType) p.set("trainer", filters.trainerType);
  if (filters.rarities?.length) p.set("rarity", filters.rarities.join(","));
  if (filters.energyTypes?.length) p.set("energy", filters.energyTypes.join(","));
  if (filters.specialAttributes?.length) p.set("attrs", filters.specialAttributes.join(","));
  if (filters.isFullArt) p.set("fullart", "1");
  if (filters.hasFoil) p.set("foil", "1");
  if (filters.nameSearch) p.set("q", filters.nameSearch);
  if (page.value > 1) p.set("page", String(page.value));

  // Preserve mode param from usePokeproxy (if set)
  const current = new URLSearchParams(window.location.search);
  const mode = current.get("mode");
  if (mode && mode !== "original") p.set("mode", mode);

  return p;
}

function writeUrl() {
  const params = filtersToParams();
  const qs = params.toString();
  const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
  history.replaceState(null, "", url);
}

function readUrl() {
  const p = new URLSearchParams(window.location.search);

  const sets = p.get("sets");
  if (sets) filters.sets = sets.split(",");

  const era = p.get("era");
  if (era === "sv" || era === "swsh") filters.era = era;

  const cat = p.get("cat");
  if (cat === "Pokemon" || cat === "Trainer" || cat === "Energy") filters.category = cat;

  const trainer = p.get("trainer");
  if (trainer) filters.trainerType = trainer;

  const rarity = p.get("rarity");
  if (rarity) filters.rarities = rarity.split(",");

  const energy = p.get("energy");
  if (energy) filters.energyTypes = energy.split(",");

  const attrs = p.get("attrs");
  if (attrs) filters.specialAttributes = attrs.split(",") as SpecialAttribute[];

  if (p.get("fullart") === "1") filters.isFullArt = true;
  if (p.get("foil") === "1") filters.hasFoil = true;

  const q = p.get("q");
  if (q) filters.nameSearch = q;

  const pg = p.get("page");
  if (pg) page.value = Math.max(1, parseInt(pg, 10) || 1);
}

// Read URL on module init
readUrl();

// Reset page to 1 when any filter changes
watch(() => ({ ...filters }), () => {
  page.value = 1;
}, { deep: true });

// Write URL on any state change
let writeTimer: ReturnType<typeof setTimeout>;
watch([() => ({ ...filters }), page], () => {
  clearTimeout(writeTimer);
  writeTimer = setTimeout(writeUrl, 100);
}, { deep: true });

/** Returns set codes that need to be loaded (from URL restore) */
function getPendingSetLoads(): string[] {
  return filters.sets ?? [];
}

export function useFilters() {
  function setSets(sets: string[]) { filters.sets = sets.length ? sets : undefined; }
  function setEra(era?: "sv" | "swsh") { filters.era = era; }
  function setCategory(category?: "Pokemon" | "Trainer" | "Energy") { filters.category = category; }
  function setTrainerType(trainerType?: string) { filters.trainerType = trainerType; }
  function setRarities(rarities: string[]) { filters.rarities = rarities.length ? rarities : undefined; }
  function setEnergyTypes(energyTypes: string[]) { filters.energyTypes = energyTypes.length ? energyTypes : undefined; }
  function setSpecialAttrs(attrs: SpecialAttribute[]) { filters.specialAttributes = attrs.length ? attrs : undefined; }
  function setFullArt(value?: boolean) { filters.isFullArt = value; }
  function setFoil(value?: boolean) { filters.hasFoil = value; }
  function setNameSearch(name: string) { filters.nameSearch = name || undefined; }

  function reset() {
    filters.sets = undefined;
    filters.era = undefined;
    filters.category = undefined;
    filters.trainerType = undefined;
    filters.rarities = undefined;
    filters.energyTypes = undefined;
    filters.specialAttributes = undefined;
    filters.isFullArt = undefined;
    filters.hasFoil = undefined;
    filters.nameSearch = undefined;
    page.value = 1;
  }

  return {
    filters, page,
    setSets, setEra, setCategory, setTrainerType,
    setRarities, setEnergyTypes, setSpecialAttrs,
    setFullArt, setFoil, setNameSearch, reset,
    getPendingSetLoads,
  };
}
