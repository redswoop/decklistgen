<script setup lang="ts">
// Admin → Codes tab. Owns the invite-code list, the create form, and copy/delete
// actions. Max-uses parsing is the one branchy bit — delegated to the tested
// parseMaxUses helper. Styling: namespaced .admin-overlay rules in admin.css.
import { ref, onMounted } from "vue";
import { api } from "../../lib/client.js";
import type { InviteCode } from "../../../shared/types/user.js";
import { formatDate } from "../../lib/date-format.js";
import { parseMaxUses } from "../../lib/invite-code-form.js";

const inviteCodes = ref<InviteCode[]>([]);
const codesLoading = ref(true);
const newCodeLabel = ref("");
const newCodeAuthorized = ref(true);
const newCodeMaxUses = ref("");
const creatingCode = ref(false);
const createCodeError = ref<string | null>(null);
const copiedCode = ref<string | null>(null);

async function loadCodes() {
  codesLoading.value = true;
  try {
    inviteCodes.value = await api.listInviteCodes();
  } catch {}
  codesLoading.value = false;
}

async function handleCreateCode() {
  if (!newCodeLabel.value.trim()) return;
  const parsed = parseMaxUses(newCodeMaxUses.value);
  if (!parsed.ok) {
    createCodeError.value = parsed.error;
    return;
  }
  creatingCode.value = true;
  createCodeError.value = null;
  try {
    await api.createInviteCode({
      label: newCodeLabel.value.trim(),
      isAuthorized: newCodeAuthorized.value,
      maxUses: parsed.value,
    });
    newCodeLabel.value = "";
    newCodeMaxUses.value = "";
    newCodeAuthorized.value = true;
    await loadCodes();
  } catch (e) {
    createCodeError.value = e instanceof Error ? e.message : String(e);
  }
  creatingCode.value = false;
}

async function handleDeleteCode(code: string) {
  try {
    await api.deleteInviteCode(code);
    await loadCodes();
  } catch {}
}

function copyCode(code: string) {
  navigator.clipboard.writeText(code);
  copiedCode.value = code;
  setTimeout(() => {
    if (copiedCode.value === code) copiedCode.value = null;
  }, 2000);
}

onMounted(loadCodes);
</script>

<template>
  <div class="admin-body">
    <div class="invite-form">
      <h3 class="section-title">Create Invite Code</h3>
      <div class="form-row">
        <input
          v-model="newCodeLabel"
          type="text"
          placeholder="Label (e.g. Pokemon Work Group)"
          class="form-input"
        />
        <input
          v-model="newCodeMaxUses"
          type="text"
          inputmode="numeric"
          placeholder="Max uses (blank = unlimited)"
          class="form-input form-input-sm"
        />
        <label class="form-checkbox">
          <input type="checkbox" v-model="newCodeAuthorized" />
          <span>Authorized</span>
        </label>
        <button
          class="form-submit"
          :disabled="creatingCode || !newCodeLabel.trim()"
          @click="handleCreateCode"
        >{{ creatingCode ? "..." : "Create" }}</button>
      </div>
      <div v-if="createCodeError" class="form-error">{{ createCodeError }}</div>
    </div>

    <div v-if="codesLoading" class="loading">Loading codes...</div>
    <table v-else-if="inviteCodes.length" class="admin-table">
      <thead>
        <tr>
          <th>Label</th>
          <th>Code</th>
          <th>Uses</th>
          <th>Authorized</th>
          <th>Created</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="code in inviteCodes" :key="code.code">
          <td>
            <span class="user-name">{{ code.label }}</span>
          </td>
          <td>
            <code class="code-value">{{ code.code }}</code>
          </td>
          <td>
            <span class="use-count">
              {{ code.useCount }}{{ code.maxUses != null ? ` / ${code.maxUses}` : "" }}
            </span>
          </td>
          <td>
            <span :class="['badge', code.isAuthorized ? 'badge-auth' : 'badge-free']">
              {{ code.isAuthorized ? "Yes" : "No" }}
            </span>
          </td>
          <td class="date-cell">{{ formatDate(code.createdAt) }}</td>
          <td>
            <div class="action-btns">
              <button
                class="action-btn"
                :class="{ 'action-copied': copiedCode === code.code }"
                @click="copyCode(code.code)"
              >{{ copiedCode === code.code ? "Copied" : "Copy" }}</button>
              <button
                class="action-btn action-delete"
                @click="handleDeleteCode(code.code)"
              >Del</button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-else class="empty-state">No invite codes yet.</div>
  </div>
</template>
