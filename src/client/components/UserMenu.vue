<script setup lang="ts">
import { ref } from "vue";
import { useAuth } from "../composables/useAuth.js";

const { currentUser, isAdmin, logout } = useAuth();
const open = ref(false);

function toggle() {
  open.value = !open.value;
}

function handleLogout() {
  open.value = false;
  logout();
}

function handleClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (!target.closest('.user-menu')) {
    open.value = false;
  }
}
</script>

<template>
  <div class="user-menu" @click.stop>
    <button class="user-menu-trigger" @click="toggle">
      {{ currentUser?.displayName ?? "User" }}
    </button>
    <Teleport to="body">
      <div v-if="open" class="user-menu-backdrop" @click="open = false" />
    </Teleport>
    <div v-if="open" class="user-menu-dropdown">
      <div class="user-menu-info">
        <div class="user-menu-name">{{ currentUser?.displayName }}</div>
        <div class="user-menu-email">{{ currentUser?.email }}</div>
        <div v-if="isAdmin" class="user-menu-badge">Admin</div>
      </div>
      <div class="user-menu-divider" />
      <button class="user-menu-item" @click="handleLogout">Log Out</button>
    </div>
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
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
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

.user-menu-badge {
  display: inline-block;
  margin-top: 4px;
  padding: 1px 6px;
  background: #e94560;
  color: white;
  font-size: 10px;
  font-weight: 600;
  border-radius: 3px;
  text-transform: uppercase;
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
