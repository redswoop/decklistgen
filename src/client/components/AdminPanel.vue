<script setup lang="ts">
// Thin controller for the admin overlay: owns the active tab + shell chrome and
// mounts one self-contained section per tab. Each section (Users / Codes /
// Magic Links) holds its own state + api calls; Sync is the existing
// SyncDecksPanel. Styles live in styles/admin.css (namespaced .admin-overlay).
import { ref } from "vue";
import SyncDecksPanel from "./SyncDecksPanel.vue";
import UsersAdminSection from "./admin/UsersAdminSection.vue";
import InviteCodesAdminSection from "./admin/InviteCodesAdminSection.vue";
import MagicLinksAdminSection from "./admin/MagicLinksAdminSection.vue";

defineEmits<{
  (e: "close"): void;
}>();

const activeTab = ref<"users" | "invites" | "codes" | "sync">("users");
</script>

<template>
  <div class="admin-overlay">
    <div class="admin-panel">
      <div class="admin-header">
        <h2 class="admin-title">Admin</h2>
        <div class="admin-tabs">
          <button
            :class="['tab', { active: activeTab === 'users' }]"
            @click="activeTab = 'users'"
          >Users</button>
          <button
            :class="['tab', { active: activeTab === 'codes' }]"
            @click="activeTab = 'codes'"
          >Codes</button>
          <button
            :class="['tab', { active: activeTab === 'invites' }]"
            @click="activeTab = 'invites'"
          >Magic Links</button>
          <button
            :class="['tab', { active: activeTab === 'sync' }]"
            @click="activeTab = 'sync'"
          >Sync</button>
        </div>
        <div class="header-spacer" />
        <button class="close-btn" @click="$emit('close')">&times;</button>
      </div>

      <UsersAdminSection v-if="activeTab === 'users'" />
      <InviteCodesAdminSection v-else-if="activeTab === 'codes'" />
      <MagicLinksAdminSection v-else-if="activeTab === 'invites'" />
      <div v-else-if="activeTab === 'sync'" class="admin-body">
        <SyncDecksPanel />
      </div>
    </div>
  </div>
</template>
