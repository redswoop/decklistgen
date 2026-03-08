<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useFilters } from "../composables/useFilters.js";
import { useSets, useFilterOptions } from "../composables/useCards.js";
import { useEraLoader } from "../composables/useEraLoader.js";
import type { SpecialAttribute } from "../../shared/types/filters.js";

const emit = defineEmits<{ collapse: [] }>();

const {
  filters, setSets, setEra, setCategory, setTrainerType,
  setRarities, setEnergyTypes, setSpecialAttrs,
  setFullArt, setFoil, reset,
} = useFilters();

const { data: sets } = useSets();
const { data: filterOpts } = useFilterOptions();
const { loadingEra, loadingSet, loadEra, loadSet, restoreFromUrl } = useEraLoader();

const sidebarEra = ref(filters.era ?? "");

// Collapsible filter groups
const categoryOpen = ref(true);
const propsOpen = ref(true);

// Auto-load sets restored from URL
onMounted(() => restoreFromUrl());

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

async function handleEraChange(e: Event) {
  const val = (e.target as HTMLSelectElement).value;
  sidebarEra.value = val;
  const era = (val as "sv" | "swsh") || undefined;
  if (era) {
    await loadEra(era);
  } else {
    setEra(undefined);
  }
}

function handleSetSelectChange(e: Event) {
  const val = (e.target as HTMLSelectElement).value;
  if (val) loadSet(val);
}

function handleRemoveSet(code: string) {
  setSets((filters.sets ?? []).filter((s) => s !== code));
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

const isPokemonCategory = computed(() =>
  !filters.category || filters.category === "Pokemon"
);

const isAttrEnabled = (attr: SpecialAttribute) =>
  isPokemonCategory.value
  && (filterOpts.value?.availableAttributes?.includes(attr) ?? false);

const isEnergyTypeEnabled = computed(() => isPokemonCategory.value);

// Badge counts for collapsed groups
const categoryFilterCount = computed(() => {
  let count = 0;
  if (filters.category) count++;
  if (filters.trainerType) count++;
  return count;
});

const propsFilterCount = computed(() => {
  let count = 0;
  if (filters.rarities?.length) count++;
  if (filters.energyTypes?.length) count++;
  if (filters.specialAttributes?.length) count += filters.specialAttributes.length;
  if (filters.isFullArt) count++;
  if (filters.hasFoil) count++;
  return count;
});
</script>

<template>
  <div class="sidebar">
    <div class="sidebar-header">
      <span class="sidebar-header-title">Filters</span>
      <button class="sidebar-collapse-btn" @click="emit('collapse')">&lsaquo;</button>
    </div>

    <div class="sidebar-body">
      <!-- Data Source section -->
      <div class="sidebar-section-label">Data Source</div>

      <h2>Era</h2>
      <select :value="sidebarEra" :disabled="loadingEra" @change="handleEraChange">
        <option value="">All Eras</option>
        <option value="sv">Scarlet &amp; Violet</option>
        <option value="swsh">Sword &amp; Shield</option>
      </select>
      <div v-if="loadingEra" class="era-progress"><div class="era-progress-bar" /></div>

      <h2>Sets</h2>
      <select value="" :disabled="!!loadingSet" @change="handleSetSelectChange">
        <option value="">{{ loadingSet ? `Loading ${loadingSet}...` : "Load a set..." }}</option>
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

      <!-- Divider between data source and filters -->
      <div class="sidebar-divider" />
      <div class="sidebar-section-label">Filter Results</div>

      <!-- Category group -->
      <div class="filter-group-header" @click="categoryOpen = !categoryOpen">
        <span class="filter-group-chevron">{{ categoryOpen ? '\u25BC' : '\u25B6' }}</span>
        <span>Category</span>
        <span v-if="!categoryOpen && categoryFilterCount" class="filter-badge">{{ categoryFilterCount }}</span>
      </div>
      <div v-if="categoryOpen" class="filter-group-body">
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
      </div>

      <!-- Card Properties group -->
      <div class="filter-group-header" @click="propsOpen = !propsOpen">
        <span class="filter-group-chevron">{{ propsOpen ? '\u25BC' : '\u25B6' }}</span>
        <span>Card Properties</span>
        <span v-if="!propsOpen && propsFilterCount" class="filter-badge">{{ propsFilterCount }}</span>
      </div>
      <div v-if="propsOpen" class="filter-group-body">
        <h2>Rarity</h2>
        <select :value="filters.rarities?.[0] ?? ''" @change="handleRarityChange">
          <option value="">All</option>
          <option v-for="r in filterOpts?.rarities" :key="r" :value="r">{{ r }}</option>
        </select>

        <h2 :class="{ disabled: !isEnergyTypeEnabled }">Energy Type</h2>
        <select
          :value="filters.energyTypes?.[0] ?? ''"
          :disabled="!isEnergyTypeEnabled"
          :class="{ disabled: !isEnergyTypeEnabled }"
          @change="handleEnergyTypeChange"
        >
          <option value="">All</option>
          <option v-for="t in filterOpts?.energyTypes" :key="t" :value="t">{{ t }}</option>
        </select>

        <h2>Attributes</h2>
        <label
          v-for="attr in SPECIAL_ATTRS"
          :key="attr"
          :class="{ disabled: !isAttrEnabled(attr) }"
        >
          <input
            type="checkbox"
            :checked="filters.specialAttributes?.includes(attr) ?? false"
            :disabled="!isAttrEnabled(attr)"
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
      </div>

      <button class="secondary" @click="reset()">Reset Filters</button>
    </div>
  </div>
</template>
