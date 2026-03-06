<script setup lang="ts">
import { ref, computed } from "vue";
import { useQueryClient } from "@tanstack/vue-query";
import { useFilters } from "../composables/useFilters.js";
import { useSets, useFilterOptions } from "../composables/useCards.js";
import { api } from "../api/client.js";
import type { SpecialAttribute } from "../../shared/types/filters.js";

const emit = defineEmits<{ collapse: [] }>();

const {
  filters, setSets, setEra, setCategory, setTrainerType,
  setRarities, setEnergyTypes, setSpecialAttrs,
  setFullArt, setFoil, setNameSearch, reset,
} = useFilters();

const { data: sets } = useSets();
const { data: filterOpts } = useFilterOptions();
const queryClient = useQueryClient();

const loading = ref<string | null>(null);
const loadingEra = ref(false);
const sidebarEra = ref("");

const SPECIAL_ATTRS: SpecialAttribute[] = [
  "ex", "V", "VMAX", "VSTAR", "Ancient", "Future", "Tera",
];

const setInfo = computed(() => {
  const map = new Map<string, { name: string; era: string; tcgdexId: string }>();
  sets.value?.forEach((s) =>
    map.set(s.code, { name: s.name, era: s.era, tcgdexId: s.tcgdexId })
  );
  return map;
});

const visibleSets = computed(() => {
  if (!sets.value) return [];
  if (!sidebarEra.value) return sets.value;
  return sets.value.filter((s) => s.era === sidebarEra.value);
});

const activeSets = computed(() => filters.sets ?? []);

function formatSetLabel(code: string) {
  const info = setInfo.value.get(code);
  if (!info) return code;
  return `${info.name} (${info.tcgdexId})`;
}

function handleEraChange(e: Event) {
  const val = (e.target as HTMLSelectElement).value;
  sidebarEra.value = val;
  setEra((val as "sv" | "swsh") || undefined);
}

async function handleLoadSet(code: string) {
  loading.value = code;
  try {
    await api.loadSet(code);
    queryClient.invalidateQueries({ queryKey: ["sets"] });
    queryClient.invalidateQueries({ queryKey: ["filterOptions"] });
    queryClient.invalidateQueries({ queryKey: ["cards"] });
    const current = filters.sets ?? [];
    if (!current.includes(code)) {
      setSets([...current, code]);
    }
  } finally {
    loading.value = null;
  }
}

function handleSetSelectChange(e: Event) {
  const val = (e.target as HTMLSelectElement).value;
  if (val) handleLoadSet(val);
}

function handleRemoveSet(code: string) {
  setSets((filters.sets ?? []).filter((s) => s !== code));
}

async function handleLoadEra() {
  const era = sidebarEra.value;
  if (era !== "sv" && era !== "swsh") return;
  loadingEra.value = true;
  try {
    await api.loadEra(era);
    queryClient.invalidateQueries({ queryKey: ["sets"] });
    queryClient.invalidateQueries({ queryKey: ["filterOptions"] });
    queryClient.invalidateQueries({ queryKey: ["cards"] });
    setEra(era);
    setSets([]);
  } finally {
    loadingEra.value = false;
  }
}

function handleNameInput(e: Event) {
  setNameSearch((e.target as HTMLInputElement).value);
}

function handleCategoryChange(e: Event) {
  const val = (e.target as HTMLSelectElement).value;
  setCategory((val as "Pokemon" | "Trainer" | "Energy") || undefined);
}

function handleTrainerTypeChange(e: Event) {
  setTrainerType((e.target as HTMLSelectElement).value || undefined);
}

function handleRarityChange(e: Event) {
  const val = (e.target as HTMLSelectElement).value;
  setRarities(val ? [val] : []);
}

function handleEnergyTypeChange(e: Event) {
  const val = (e.target as HTMLSelectElement).value;
  setEnergyTypes(val ? [val] : []);
}

function handleCheckboxAttr(attr: SpecialAttribute, e: Event) {
  const checked = (e.target as HTMLInputElement).checked;
  const current = filters.specialAttributes ?? [];
  setSpecialAttrs(
    checked ? [...current, attr] : current.filter((a) => a !== attr)
  );
}

function handleFullArtChange(e: Event) {
  setFullArt((e.target as HTMLInputElement).checked ? true : undefined);
}

function handleFoilChange(e: Event) {
  setFoil((e.target as HTMLInputElement).checked ? true : undefined);
}
</script>

<template>
  <div class="sidebar">
    <h2>Era</h2>
    <select :value="sidebarEra" @change="handleEraChange">
      <option value="">All Eras</option>
      <option value="sv">Scarlet &amp; Violet</option>
      <option value="swsh">Sword &amp; Shield</option>
    </select>
    <button
      v-if="sidebarEra"
      :disabled="loadingEra"
      @click="handleLoadEra"
    >
      {{ loadingEra
        ? `Loading ${sidebarEra === "sv" ? "SV" : "SWSH"} era...`
        : `Load all ${sidebarEra === "sv" ? "SV" : "SWSH"} sets` }}
    </button>

    <h2>Sets</h2>
    <select value="" :disabled="!!loading" @change="handleSetSelectChange">
      <option value="">{{ loading ? `Loading ${loading}...` : "Load a set..." }}</option>
      <option v-for="s in visibleSets" :key="s.code" :value="s.code">
        {{ s.name }} ({{ s.tcgdexId }}){{ s.loaded ? " *" : "" }}
      </option>
    </select>

    <div v-if="activeSets.length > 0" class="set-tags">
      <span
        v-for="code in activeSets"
        :key="code"
        class="set-tag"
        @click="handleRemoveSet(code)"
      >
        {{ formatSetLabel(code) }}
        <span class="set-tag-x">&times;</span>
      </span>
    </div>

    <h2>Name</h2>
    <input
      type="text"
      placeholder="Search by name..."
      :value="filters.nameSearch ?? ''"
      @input="handleNameInput"
    />

    <h2>Category</h2>
    <select :value="filters.category ?? ''" @change="handleCategoryChange">
      <option value="">All</option>
      <option value="Pokemon">Pokemon</option>
      <option value="Trainer">Trainer</option>
      <option value="Energy">Energy</option>
    </select>

    <template v-if="filters.category === 'Trainer'">
      <h2>Trainer Type</h2>
      <select :value="filters.trainerType ?? ''" @change="handleTrainerTypeChange">
        <option value="">All</option>
        <option v-for="t in filterOpts?.trainerTypes" :key="t" :value="t">{{ t }}</option>
      </select>
    </template>

    <h2>Rarity</h2>
    <select :value="filters.rarities?.[0] ?? ''" @change="handleRarityChange">
      <option value="">All</option>
      <option v-for="r in filterOpts?.rarities" :key="r" :value="r">{{ r }}</option>
    </select>

    <h2>Energy Type</h2>
    <select :value="filters.energyTypes?.[0] ?? ''" @change="handleEnergyTypeChange">
      <option value="">All</option>
      <option v-for="t in filterOpts?.energyTypes" :key="t" :value="t">{{ t }}</option>
    </select>

    <h2>Attributes</h2>
    <label v-for="attr in SPECIAL_ATTRS" :key="attr">
      <input
        type="checkbox"
        :checked="filters.specialAttributes?.includes(attr) ?? false"
        @change="handleCheckboxAttr(attr, $event)"
      />
      {{ attr }}
    </label>

    <h2>Variants</h2>
    <label>
      <input
        type="checkbox"
        :checked="filters.isFullArt === true"
        @change="handleFullArtChange"
      />
      Full Art only
    </label>
    <label>
      <input
        type="checkbox"
        :checked="filters.hasFoil === true"
        @change="handleFoilChange"
      />
      Foil only
    </label>

    <button class="secondary" @click="reset()">Reset Filters</button>
    <button class="collapse-btn" @click="emit('collapse')">&laquo; Collapse</button>
  </div>
</template>
