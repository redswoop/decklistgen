<script setup lang="ts">
import { ref } from "vue";
import { api } from "../lib/client.js";

const props = defineProps<{
  deckId: string;
}>();

const emit = defineEmits<{
  close: [];
}>();

const quantityMode = ref<"all-dupes" | "one-each">("all-dupes");
const includePokemon = ref(true);
const includeSupporters = ref(true);
const includeItems = ref(true);
const includeTools = ref(true);
const includeStadiums = ref(true);
const includeBasicEnergy = ref(true);

function handlePrint() {
  const params: Record<string, string> = {};

  if (quantityMode.value === "one-each") {
    params.qty = "one-each";
  }
  if (!includeBasicEnergy.value) {
    params.noBasicEnergy = "1";
  }

  const excluded: string[] = [];
  if (!includePokemon.value) excluded.push("pokemon");
  if (!includeSupporters.value) excluded.push("supporters");
  if (!includeItems.value) excluded.push("items");
  if (!includeTools.value) excluded.push("tools");
  if (!includeStadiums.value) excluded.push("stadiums");
  if (excluded.length) {
    params.exclude = excluded.join(",");
  }

  window.open(api.deckPrintUrl(props.deckId, params), "_blank");
  emit("close");
}
</script>

<template>
  <div class="dialog-overlay" @click="emit('close')">
    <div class="dialog print-dialog" @click.stop>
      <h3>Print Options</h3>

      <div class="print-section-label">Quantity</div>
      <div class="print-radio-group">
        <label class="print-radio">
          <input type="radio" v-model="quantityMode" value="all-dupes" />
          All copies
        </label>
        <label class="print-radio">
          <input type="radio" v-model="quantityMode" value="one-each" />
          1 of each
        </label>
      </div>

      <div class="print-section-label">Include</div>
      <div class="print-checkbox-list">
        <label class="print-checkbox">
          <input type="checkbox" v-model="includePokemon" />
          Pokemon
        </label>
        <label class="print-checkbox">
          <input type="checkbox" v-model="includeSupporters" />
          Supporters
        </label>
        <label class="print-checkbox">
          <input type="checkbox" v-model="includeItems" />
          Items
        </label>
        <label class="print-checkbox">
          <input type="checkbox" v-model="includeTools" />
          Tools
        </label>
        <label class="print-checkbox">
          <input type="checkbox" v-model="includeStadiums" />
          Stadiums
        </label>
        <label class="print-checkbox">
          <input type="checkbox" v-model="includeBasicEnergy" />
          Basic Energy
        </label>
      </div>

      <div class="dialog-actions">
        <button class="btn-secondary" @click="emit('close')">Cancel</button>
        <button class="btn-primary" @click="handlePrint">Print</button>
      </div>
    </div>
  </div>
</template>
