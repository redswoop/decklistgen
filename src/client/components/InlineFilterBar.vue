<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useFilters } from "../composables/useFilters.js";
import { useSets, useFilterOptions } from "../composables/useCards.js";
import { useEraLoader } from "../composables/useEraLoader.js";
import type { Era } from "../../shared/types/card.js";
import type { SpecialAttribute } from "../../shared/types/filters.js";
import { EFFECT_FACETS, EFFECT_TAGS, type EffectTag } from "../../shared/utils/effect-tags.js";

const {
  filters, setSets, setEra, setCategory, setTrainerType,
  setRarities, setEnergyTypes, setSpecialAttrs,
  setFullArt, setFoil, setEffectTags, reset,
} = useFilters();

const { data: sets } = useSets();
const { data: filterOpts } = useFilterOptions();
const { loadingEra } = useEraLoader();

const sidebarEra = ref<string>(filters.era ?? "all");
watch(() => filters.era, (v) => { sidebarEra.value = v ?? "all"; });

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

function handleEraChange(e: Event) {
  const val = (e.target as HTMLSelectElement).value as Era | "all";
  sidebarEra.value = val;
  setEra(val);
  setSets([]);
}

function handleSetSelectChange(e: Event) {
  const target = e.target as HTMLSelectElement;
  const val = target.value;
  if (!val) return;
  const current = filters.sets ?? [];
  if (!current.includes(val)) setSets([...current, val]);
  target.value = "";
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

// Function tags, laid out one cluster per facet.
type TagDef = (typeof EFFECT_TAGS)[number];
const TAG_FACETS = EFFECT_FACETS.map((facet) => ({
  ...facet,
  tags: EFFECT_TAGS.filter((t) => t.facet === facet.id),
}));

// Only Supporters and Items carry function tags so far.
const isTaggedCategory = computed(() =>
  (!filters.category || filters.category === "Trainer")
  && (!filters.trainerType || filters.trainerType === "Supporter" || filters.trainerType === "Item")
);

const isTagActive = (id: EffectTag) => filters.effectTags?.includes(id) ?? false;

// A selected tag stays clickable so it can always be turned off.
const isTagEnabled = (id: EffectTag) =>
  isTagActive(id)
  || (isTaggedCategory.value && (filterOpts.value?.effectTags?.includes(id) ?? false));

function tagTitle(tag: TagDef) {
  if (isTagEnabled(tag.id)) return tag.description;
  if (!isTaggedCategory.value) return `${tag.description} — only Supporters and Items are tagged so far`;
  return `${tag.description} — no loaded card has this tag`;
}

function handleTagChange(id: EffectTag, e: Event) {
  const checked = (e.target as HTMLInputElement).checked;
  const current = filters.effectTags ?? [];
  setEffectTags(checked ? [...current, id] : current.filter((t) => t !== id));
}

const hasActiveFilters = computed(() => {
  return !!(
    filters.category || filters.trainerType || filters.rarities?.length ||
    filters.energyTypes?.length || filters.specialAttributes?.length ||
    filters.isFullArt || filters.hasFoil || filters.effectTags?.length
  );
});
</script>

<template>
  <div class="inline-filter-bar">
    <div class="ifb-row">
      <select class="ifb-select" :value="sidebarEra" @change="handleEraChange">
        <option value="all">All Eras</option>
        <option value="sv">Scarlet &amp; Violet</option>
        <option value="swsh">Sword &amp; Shield</option>
        <option value="me">Mega Evolution</option>
        <option value="custom">Custom</option>
      </select>

      <select class="ifb-select ifb-select-wide" value="" @change="handleSetSelectChange">
        <option value="">Add set...</option>
        <option v-for="s in visibleSets" :key="s.code" :value="s.code">
          {{ s.name }} ({{ s.tcgdexId }})
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
        class="ifb-reset-btn"
        :disabled="!hasActiveFilters && !activeSets.length"
        @click="reset()"
      >Reset</button>
    </div>

    <div v-if="loadingEra" class="ifb-loading">
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

    <div class="ifb-row ifb-row-expanded">
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

    <div class="ifb-row ifb-row-tags">
      <span class="ifb-row-label" title="Filter by what a card does. Pick several to require all of them.">Does</span>
      <span v-for="facet in TAG_FACETS" :key="facet.id" class="ifb-facet" :title="facet.label">
        <label
          v-for="tag in facet.tags"
          :key="tag.id"
          :class="['ifb-chip', { disabled: !isTagEnabled(tag.id), active: isTagActive(tag.id) }]"
          :title="tagTitle(tag)"
          :data-effect-tag="tag.id"
        >
          <input
            type="checkbox"
            :checked="isTagActive(tag.id)"
            :disabled="!isTagEnabled(tag.id)"
            @change="handleTagChange(tag.id, $event)"
          />
          {{ tag.label }}
        </label>
      </span>
    </div>
  </div>
</template>
