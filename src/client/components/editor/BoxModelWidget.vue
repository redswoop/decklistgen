<script setup lang="ts">
const props = defineProps<{
  values: Record<string, number | string>;
}>();

const emit = defineEmits<{
  update: [key: string, value: number];
}>();

function val(key: string): number {
  return Number(props.values[key] || 0);
}

function onChange(e: Event, key: string) {
  const input = e.target as HTMLInputElement;
  emit("update", key, parseInt(input.value) || 0);
}
</script>

<template>
  <div class="box-model">
    <div class="box-layer box-margin">
      <span class="box-layer-label">margin</span>
      <div class="box-top">
        <input class="box-val" type="number" :value="val('marginTop')" @change="onChange($event, 'marginTop')" />
      </div>
      <div class="box-left">
        <input class="box-val" type="number" :value="val('marginLeft')" @change="onChange($event, 'marginLeft')" />
      </div>
      <div class="box-inner">
        <div class="box-layer box-padding">
          <span class="box-layer-label">padding</span>
          <div class="box-top">
            <input class="box-val" type="number" :value="val('paddingTop')" @change="onChange($event, 'paddingTop')" />
          </div>
          <div class="box-left">
            <input class="box-val" type="number" :value="val('paddingLeft')" @change="onChange($event, 'paddingLeft')" />
          </div>
          <div class="box-inner"></div>
          <div class="box-right">
            <input class="box-val" type="number" :value="val('paddingRight')" @change="onChange($event, 'paddingRight')" />
          </div>
          <div class="box-bottom">
            <input class="box-val" type="number" :value="val('paddingBottom')" @change="onChange($event, 'paddingBottom')" />
          </div>
        </div>
      </div>
      <div class="box-right">
        <input class="box-val" type="number" :value="val('marginRight')" @change="onChange($event, 'marginRight')" />
      </div>
      <div class="box-bottom">
        <input class="box-val" type="number" :value="val('marginBottom')" @change="onChange($event, 'marginBottom')" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.box-model { margin: 8px 0; }
.box-layer { display: grid; grid-template-columns: 28px 1fr 28px; grid-template-rows: 22px 1fr 22px; position: relative; border: 1px dashed; border-radius: 3px; }
.box-layer-label { position: absolute; top: 1px; left: 4px; font-size: 9px; opacity: 0.5; pointer-events: none; }
.box-margin { border-color: rgba(246, 178, 107, 0.5); background: rgba(246, 178, 107, 0.06); }
.box-padding { border-color: rgba(147, 196, 125, 0.5); background: rgba(147, 196, 125, 0.06); }
.box-top { grid-column: 1 / -1; grid-row: 1; display: flex; align-items: center; justify-content: center; }
.box-left { grid-column: 1; grid-row: 2; display: flex; align-items: center; justify-content: center; }
.box-inner { grid-column: 2; grid-row: 2; }
.box-right { grid-column: 3; grid-row: 2; display: flex; align-items: center; justify-content: center; }
.box-bottom { grid-column: 1 / -1; grid-row: 3; display: flex; align-items: center; justify-content: center; }
.box-val { width: 28px; background: transparent; border: none; color: #ccc; text-align: center; font-size: 11px; padding: 1px 0; font-family: monospace; -moz-appearance: textfield; }
.box-val::-webkit-inner-spin-button, .box-val::-webkit-outer-spin-button { -webkit-appearance: none; }
.box-val:focus { background: rgba(255,255,255,0.12); outline: 1px solid #4a9eff; border-radius: 2px; color: #fff; }
.box-val:hover { background: rgba(255,255,255,0.05); }
</style>
