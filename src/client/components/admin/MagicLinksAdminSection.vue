<script setup lang="ts">
// Admin → Magic Links tab. Owns the link list, the create form, and
// copy/delete actions. Link lifecycle (used/expired/pending) is the tested
// linkStatus helper. Styling: namespaced .admin-overlay rules in admin.css.
import { ref, onMounted } from "vue";
import { api } from "../../lib/client.js";
import type { MagicLink } from "../../../shared/types/user.js";
import { formatDate } from "../../lib/date-format.js";
import { linkStatus } from "../../lib/magic-link-status.js";

const magicLinks = ref<MagicLink[]>([]);
const linksLoading = ref(true);
const newEmail = ref("");
const newDisplayName = ref("");
const newIsAuthorized = ref(true);
const creating = ref(false);
const createError = ref<string | null>(null);
const copiedToken = ref<string | null>(null);

async function loadLinks() {
  linksLoading.value = true;
  try {
    magicLinks.value = await api.listMagicLinks();
  } catch {}
  linksLoading.value = false;
}

async function handleCreateLink() {
  if (!newEmail.value.trim() || !newDisplayName.value.trim()) return;
  creating.value = true;
  createError.value = null;
  try {
    await api.createMagicLink({
      email: newEmail.value,
      displayName: newDisplayName.value,
      isAuthorized: newIsAuthorized.value,
    });
    newEmail.value = "";
    newDisplayName.value = "";
    newIsAuthorized.value = true;
    await loadLinks();
  } catch (e) {
    createError.value = e instanceof Error ? e.message : String(e);
  }
  creating.value = false;
}

async function handleDeleteLink(token: string) {
  try {
    await api.deleteMagicLink(token);
    await loadLinks();
  } catch {}
}

function copyLink(token: string) {
  const url = `${window.location.origin}/magic/${token}`;
  navigator.clipboard.writeText(url);
  copiedToken.value = token;
  setTimeout(() => {
    if (copiedToken.value === token) copiedToken.value = null;
  }, 2000);
}

onMounted(loadLinks);
</script>

<template>
  <div class="admin-body">
    <div class="invite-form">
      <h3 class="section-title">Create Magic Link</h3>
      <div class="form-row">
        <input
          v-model="newDisplayName"
          type="text"
          placeholder="Display name"
          class="form-input"
        />
        <input
          v-model="newEmail"
          type="email"
          placeholder="Email"
          class="form-input"
        />
        <label class="form-checkbox">
          <input type="checkbox" v-model="newIsAuthorized" />
          <span>Authorized</span>
        </label>
        <button
          class="form-submit"
          :disabled="creating || !newEmail.trim() || !newDisplayName.trim()"
          @click="handleCreateLink"
        >{{ creating ? "..." : "Create" }}</button>
      </div>
      <div v-if="createError" class="form-error">{{ createError }}</div>
    </div>

    <div v-if="linksLoading" class="loading">Loading links...</div>
    <table v-else-if="magicLinks.length" class="admin-table">
      <thead>
        <tr>
          <th>Invite</th>
          <th>Status</th>
          <th>Authorized</th>
          <th>Created</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="link in magicLinks" :key="link.token" :class="{ 'row-muted': linkStatus(link) !== 'pending' }">
          <td>
            <div class="user-cell">
              <span class="user-name">{{ link.displayName }}</span>
              <span class="user-email">{{ link.email }}</span>
            </div>
          </td>
          <td>
            <span :class="['badge', `badge-${linkStatus(link)}`]">
              {{ linkStatus(link) }}
            </span>
          </td>
          <td>
            <span :class="['badge', link.isAuthorized ? 'badge-auth' : 'badge-free']">
              {{ link.isAuthorized ? "Yes" : "No" }}
            </span>
          </td>
          <td class="date-cell">{{ formatDate(link.createdAt) }}</td>
          <td>
            <div class="action-btns">
              <button
                v-if="linkStatus(link) === 'pending'"
                class="action-btn"
                :class="{ 'action-copied': copiedToken === link.token }"
                @click="copyLink(link.token)"
              >{{ copiedToken === link.token ? "Copied" : "Copy" }}</button>
              <button
                v-if="linkStatus(link) === 'pending'"
                class="action-btn action-delete"
                @click="handleDeleteLink(link.token)"
              >Del</button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-else class="empty-state">No magic links yet.</div>
  </div>
</template>
