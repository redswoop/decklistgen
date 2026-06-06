<script setup lang="ts">
import { useActingAs } from "../composables/useActingAs.js";
import { useDecklist } from "../composables/useDecklist.js";

const { actingAsUser, clearActingAs } = useActingAs();
const { clear } = useDecklist();

// Drop any of the target's deck loaded in the working view before reverting to
// self, so a subsequent save can't target the wrong account.
function exit() {
  clear();
  clearActingAs();
}
</script>

<template>
  <div v-if="actingAsUser" class="acting-as-banner">
    <span class="aab-icon">&#9888;</span>
    <span class="aab-text">
      Viewing <strong>{{ actingAsUser.displayName }}</strong> ({{ actingAsUser.email }})'s decks —
      changes you make are saved to their account.
    </span>
    <button class="aab-exit" @click="exit">Exit</button>
  </div>
</template>

<style scoped>
.acting-as-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  background: #e94560;
  color: #fff;
  font-size: 13px;
}
.aab-icon {
  font-size: 15px;
}
.aab-text {
  flex: 1;
}
.aab-exit {
  padding: 4px 12px;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: 5px;
  color: #fff;
  font-size: 12px;
  cursor: pointer;
}
.aab-exit:hover {
  background: rgba(0, 0, 0, 0.4);
}
</style>
