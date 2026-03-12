<script setup lang="ts">
import { ref, computed, nextTick } from "vue";
import { useAuth } from "../composables/useAuth.js";

const emit = defineEmits<{
  (e: "open-admin"): void;
}>();

const { currentUser, isAdmin, isAuthorized, logout } = useAuth();
const open = ref(false);
const triggerRef = ref<HTMLElement | null>(null);
const dropdownPos = ref({ top: 0, right: 0 });

const dropdownStyle = computed(() => ({
  position: 'fixed' as const,
  top: dropdownPos.value.top + 'px',
  right: dropdownPos.value.right + 'px',
}));

function toggle() {
  open.value = !open.value;
  if (open.value) {
    nextTick(() => {
      if (triggerRef.value) {
        const rect = triggerRef.value.getBoundingClientRect();
        dropdownPos.value = {
          top: rect.bottom + 4,
          right: window.innerWidth - rect.right,
        };
      }
    });
  }
}

function handleLogout() {
  open.value = false;
  logout();
}

function handleAdmin() {
  open.value = false;
  emit("open-admin");
}
</script>

<template>
  <div class="user-menu" @click.stop>
    <button ref="triggerRef" class="user-menu-trigger" @click="toggle">
      {{ currentUser?.displayName ?? "User" }}
    </button>
    <Teleport to="body">
      <div v-if="open" class="user-menu-backdrop" @click="open = false" />
      <div v-if="open" class="user-menu-dropdown" :style="dropdownStyle">
      <div class="user-menu-info">
        <div class="user-menu-name">{{ currentUser?.displayName }}</div>
        <div class="user-menu-email">{{ currentUser?.email }}</div>
        <div class="user-menu-badges">
          <span v-if="isAdmin" class="user-menu-badge badge-admin">Admin</span>
          <span v-else-if="isAuthorized" class="user-menu-badge badge-authorized">Authorized</span>
          <span v-else class="user-menu-badge badge-free">Free</span>
        </div>
      </div>
      <div class="user-menu-divider" />
      <button v-if="isAdmin" class="user-menu-item" @click="handleAdmin">Admin Panel</button>
      <button class="user-menu-item" @click="handleLogout">Log Out</button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.user-menu {
  position: relative;
}

.user-menu-trigger {
  padding: 3px 10px;
  background: transparent;
  border: 1px solid #0f3460;
  border-radius: 4px;
  color: #7f8fa6;
  font-size: 12px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}

.user-menu-trigger:hover {
  color: #e0e0e0;
  border-color: #7f8fa6;
}

.user-menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 99;
}

.user-menu-dropdown {
  background: #16213e;
  border: 1px solid #0f3460;
  border-radius: 6px;
  min-width: 180px;
  z-index: 100;
  overflow: hidden;
}

.user-menu-info {
  padding: 10px 12px;
}

.user-menu-name {
  font-size: 13px;
  font-weight: 600;
  color: #e0e0e0;
}

.user-menu-email {
  font-size: 11px;
  color: #7f8fa6;
  margin-top: 2px;
}

.user-menu-badges {
  margin-top: 4px;
  display: flex;
  gap: 4px;
}

.user-menu-badge {
  display: inline-block;
  padding: 1px 6px;
  color: white;
  font-size: 10px;
  font-weight: 600;
  border-radius: 3px;
  text-transform: uppercase;
}

.badge-admin {
  background: #e94560;
}

.badge-authorized {
  background: #2ecc71;
}

.badge-free {
  background: #7f8fa6;
}

.user-menu-divider {
  height: 1px;
  background: #0f3460;
}

.user-menu-item {
  display: block;
  width: 100%;
  padding: 8px 12px;
  background: none;
  border: none;
  color: #7f8fa6;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}

.user-menu-item:hover {
  background: #0f3460;
  color: #e0e0e0;
}
</style>
