import { reactive } from "vue";
import type { CardFilters, SpecialAttribute } from "../../shared/types/filters.js";

const filters = reactive<CardFilters>({});

export function useFilters() {
  function setSets(sets: string[]) { filters.sets = sets; }
  function setEra(era?: "sv" | "swsh") { filters.era = era; }
  function setCategory(category?: "Pokemon" | "Trainer" | "Energy") { filters.category = category; }
  function setTrainerType(trainerType?: string) { filters.trainerType = trainerType; }
  function setRarities(rarities: string[]) { filters.rarities = rarities; }
  function setEnergyTypes(energyTypes: string[]) { filters.energyTypes = energyTypes; }
  function setSpecialAttrs(attrs: SpecialAttribute[]) { filters.specialAttributes = attrs; }
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
  }

  return {
    filters,
    setSets, setEra, setCategory, setTrainerType,
    setRarities, setEnergyTypes, setSpecialAttrs,
    setFullArt, setFoil, setNameSearch, reset,
  };
}
