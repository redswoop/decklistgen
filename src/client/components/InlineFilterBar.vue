<script setup lang="ts">
import { ref, computed } from "vue";
import { useFilters } from "../composables/useFilters.js";
import { useSets, useFilterOptions } from "../composables/useCards.js";
import { useEraLoader } from "../composables/useEraLoader.js";
import type { SpecialAttribute } from "../../shared/types/filters.js";

const {
  filters, setSets, setCategory, setTrainerType,
  setRarities, setEnergyTypes, setSpecialAttrs,
  setFullArt, setFoil, reset,
} = useFilters();

const { data: sets } = useSets();
const { data: filterOpts } = useFilterOptions();
const { loadingEra, loadingSet, loadEra, loadAllEras, loadSet } = useEraLoader();

const sidebarEra = ref<string>(filters.era ?? "all");

const SPECIAL_ATTRS: SpecialAttribute[] = [
  "ex", "V", "VMAX", "VSTAR", "Ancient", "Future", "Tera",
];

const visibleSets = computed(() => {
  if (!sets.value) return [];
  if (!sidebarEra.value || sidebarEra.value === "all") return sets.value;
  return sets.value.filter((s) => s.era === sidebarEra.value);
});

const activeSets = computed(() => filters.sets ?? []);

const setInfo = computed(() => {
  const map = new Map<string, { name: string; era: string; tcgdexId: string }>();
  sets.value?.forEach((s) =>
    map.set(s.code, { name: s.name, era: s.era, tcgdexId: s.tcgdexId })
  );
  return map;
});

function formatSetLabel(code: string) {
  const info = setInfo.value.get(code);
  if (!info) return code;
  return `${info.name} (${info.tcgdexId})`;
}

async function handleEraChange(e: Event) {
  const val = (e.target as HTMLSelectElement).value;
  sidebarEra.value = val;
  if (val === "sv" || val === "swsh") {
    await loadEra(val);
  } else {
    await loadAllEras();
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

const hasActiveFilters = computed(() => {
  return !!(
    filters.category || filters.trainerType || filters.rarities?.length ||
    filters.energyTypes?.length || filters.specialAttributes?.length ||
    filters.isFullArt || filters.hasFoil
  );
});

const showMore = ref(false);
</script>

<template>
  <div class="inline-filter-bar">
    <div class="ifb-row">
      <select class="ifb-select" :value="sidebarEra" :disabled="loadingEra" @change="handleEraChange">
        <option value="all">All Eras</option>
        <option value="sv">Scarlet &amp; Violet</option>
        <option value="swsh">Sword &amp; Shield</option>
      </select>

      <select class="ifb-select ifb-select-wide" value="" :disabled="!!loadingSet" @change="handleSetSelectChange">
        <option value="">{{ loadingSet ? `Loading ${loadingSet}...` : "Add set..." }}</option>
        <option v-for="s in visibleSets" :key="s.code" :value="s.code">
          {{ s.name }} ({{ s.tcgdexId }}){{ s.loaded ? " *" : "" }}
        </option>
      </select>

      <select class="ifb-select" :value="filters.category ?? ''" @change="handleCategoryChange">
        <option value="">All Types</option>
        <option value="Pokemon">Pokemon</option>
        <option value="Trainer">Trainer</option>
        <option value="Energy">Energy</option>
      </select>

      <select
        v-if="filters.category === 'Trainer'"
        class="ifb-select"
        :value="filters.trainerType ?? ''"
        @change="handleTrainerTypeChange"
      >
        <option value="">All Trainers</option>
        <option v-for="t in filterOpts?.trainerTypes" :key="t" :value="t">{{ t }}</option>
      </select>

      <select class="ifb-select" :value="filters.rarities?.[0] ?? ''" @change="handleRarityChange">
        <option value="">Any Rarity</option>
        <option v-for="r in filterOpts?.rarities" :key="r" :value="r">{{ r }}</option>
      </select>

      <select
        class="ifb-select"
        :value="filters.energyTypes?.[0] ?? ''"
        :disabled="!isEnergyTypeEnabled"
        @change="handleEnergyTypeChange"
      >
        <option value="">Any Energy</option>
        <option v-for="t in filterOpts?.energyTypes" :key="t" :value="t">{{ t }}</option>
      </select>

      <button
        :class="['ifb-more-btn', { active: showMore }]"
        @click="showMore = !showMore"
      >{{ showMore ? 'Less' : 'More' }}</button>

      <button
        class="ifb-reset-btn"
        :disabled="!hasActiveFilters && !activeSets.length"
        @click="reset()"
      >Reset</button>
    </div>

    <div v-if="loadingEra || loadingSet" class="ifb-loading">
      <div class="ifb-loading-bar" />
    </div>

    <div v-if="activeSets.length > 0" class="ifb-set-tags">
      <span
        v-for="code in activeSets"
        :key="code"
        class="ifb-set-tag"
        @click="handleRemoveSet(code)"
      >
        {{ formatSetLabel(code) }}
        <span class="ifb-set-tag-x">&times;</span>
      </span>
    </div>

    <div v-if="showMore" class="ifb-row ifb-row-expanded">
      <label
        v-for="attr in SPECIAL_ATTRS"
        :key="attr"
        :class="['ifb-chip', { disabled: !isAttrEnabled(attr), active: filters.specialAttributes?.includes(attr) }]"
      >
        <input
          type="checkbox"
          :checked="filters.specialAttributes?.includes(attr) ?? false"
          :disabled="!isAttrEnabled(attr)"
          @change="handleCheckboxAttr(attr, $event)"
        />
        {{ attr }}
      </label>

      <label :class="['ifb-chip', { active: filters.isFullArt }]">
        <input type="checkbox" :checked="filters.isFullArt === true" @change="handleFullArtChange" />
        Full Art
      </label>

      <label :class="['ifb-chip', { active: filters.hasFoil }]">
        <input type="checkbox" :checked="filters.hasFoil === true" @change="handleFoilChange" />
        Foil
      </label>
    </div>
  </div>
</template>
