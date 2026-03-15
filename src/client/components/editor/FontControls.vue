<script setup lang="ts">
import { ref, computed } from "vue";
import NumericStepper from "./NumericStepper.vue";
import AlignButtons from "./AlignButtons.vue";
import { FONT_FAMILY_OPTIONS, WEIGHT_OPTIONS } from "../../../shared/constants/prop-defs.js";
import { FONT_SIZES } from "../../../shared/constants/font-sizes.js";

const props = defineProps<{
  fontSize: number | string;
  fontFamily: string;
  fontWeight: string;
}>();

const emit = defineEmits<{
  update: [key: string, value: string | number];
  updateToken: [tokenName: string, value: number];
}>();

const showTokenMenu = ref(false);

/** Extract token name from "$tokenName" string */
function tokenName(): string | null {
  const fs = props.fontSize;
  if (typeof fs === "string" && fs.startsWith("$")) return fs.slice(1);
  return null;
}

/** Whether the current value is a linked token */
const isLinked = computed(() => tokenName() !== null);

/** Resolve a $token to its numeric default, or pass through raw numbers */
function resolvedSize(): number {
  const fs = props.fontSize;
  if (typeof fs === "number") return fs;
  if (typeof fs === "string" && fs.startsWith("$")) {
    const token = fs.slice(1);
    return FONT_SIZES[token] ?? FONT_SIZES.default ?? 24;
  }
  return Number(fs) || 24;
}

/** Available tokens for the relink dropdown */
const tokenOptions = computed(() =>
  Object.entries(FONT_SIZES)
    .filter(([k]) => k !== "default")
    .map(([k, v]) => ({ name: k, value: v }))
    .sort((a, b) => a.name.localeCompare(b.name))
);

function onStepperChange(v: number) {
  const tk = tokenName();
  if (tk) {
    // Linked: update the global token value
    emit("updateToken", tk, v);
  } else {
    // Unlinked: local override
    emit("update", "fontSize", v);
  }
}

function onUnlink() {
  emit("update", "fontSize", resolvedSize());
}

function onRelink(tk: string) {
  emit("update", "fontSize", `$${tk}`);
  showTokenMenu.value = false;
}

function toggleTokenMenu() {
  showTokenMenu.value = !showTokenMenu.value;
}
</script>

<template>
  <div class="font-controls">
    <label>Font</label>
    <div class="font-row">
      <NumericStepper
        :model-value="resolvedSize()"
        :min="8"
        :max="120"
        :step="1"
        @update:model-value="onStepperChange"
      />
      <!-- Linked: token chip with unlink button -->
      <span v-if="isLinked" class="token-chip" :title="`Global token: ${tokenName()}`">
        {{ tokenName() }}
        <button class="unlink-btn" title="Unlink — use local value" @click="onUnlink">&times;</button>
      </span>
      <!-- Unlinked: link button to rebind -->
      <span v-else class="link-wrap">
        <button class="link-btn" title="Link to a font-size token" @click="toggleTokenMenu">&#x1f517;</button>
        <div v-if="showTokenMenu" class="token-menu">
          <button
            v-for="opt in tokenOptions"
            :key="opt.name"
            class="token-menu-item"
            @click="onRelink(opt.name)"
          >{{ opt.name }} <span class="token-val">{{ opt.value }}</span></button>
        </div>
      </span>
      <AlignButtons
        :model-value="fontFamily"
        :options="FONT_FAMILY_OPTIONS"
        @update:model-value="v => emit('update', 'fontFamily', v)"
      />
      <AlignButtons
        :model-value="fontWeight"
        :options="WEIGHT_OPTIONS"
        @update:model-value="v => emit('update', 'fontWeight', v)"
      />
    </div>
  </div>
</template>

<style scoped>
.font-controls { margin-bottom: 8px; }
.font-controls label { display: block; font-size: 11px; color: #888; margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.5px; }
.font-row { display: flex; gap: 4px; align-items: center; flex-wrap: wrap; }
.font-row :deep(.align-buttons) { margin-bottom: 0; }

.token-chip {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  background: rgba(74, 158, 255, 0.15);
  color: #4a9eff;
  font-size: 10px;
  padding: 2px 4px 2px 6px;
  border-radius: 3px;
  white-space: nowrap;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.unlink-btn {
  background: none;
  border: none;
  color: #888;
  font-size: 13px;
  cursor: pointer;
  padding: 0 2px;
  line-height: 1;
}
.unlink-btn:hover { color: #e88; }

.link-wrap { position: relative; }
.link-btn {
  background: none;
  border: 1px solid #444;
  border-radius: 3px;
  color: #888;
  font-size: 12px;
  cursor: pointer;
  padding: 2px 4px;
  line-height: 1;
}
.link-btn:hover { color: #4a9eff; border-color: #4a9eff; }

.token-menu {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 100;
  background: #1a1a2e;
  border: 1px solid #444;
  border-radius: 4px;
  max-height: 200px;
  overflow-y: auto;
  min-width: 160px;
  margin-top: 2px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}
.token-menu-item {
  display: flex;
  justify-content: space-between;
  width: 100%;
  background: none;
  border: none;
  color: #ccc;
  font-size: 11px;
  padding: 4px 8px;
  cursor: pointer;
  text-align: left;
}
.token-menu-item:hover { background: rgba(74, 158, 255, 0.15); color: #fff; }
.token-val { color: #666; margin-left: 8px; }
</style>
