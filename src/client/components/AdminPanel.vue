<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { api } from "../lib/client.js";
import type { AdminUser, MagicLink, InviteCode } from "../../shared/types/user.js";

const emit = defineEmits<{
  (e: "close"): void;
}>();

// Users state
const users = ref<AdminUser[]>([]);
const usersLoading = ref(true);

// Magic links state
const magicLinks = ref<MagicLink[]>([]);
const linksLoading = ref(true);

// Create magic link form
const newEmail = ref("");
const newDisplayName = ref("");
const newIsAuthorized = ref(true);
const creating = ref(false);
const createError = ref<string | null>(null);

// Invite codes state
const inviteCodes = ref<InviteCode[]>([]);
const codesLoading = ref(true);
const newCodeLabel = ref("");
const newCodeAuthorized = ref(true);
const newCodeMaxUses = ref<string>("");
const creatingCode = ref(false);
const createCodeError = ref<string | null>(null);
const copiedCode = ref<string | null>(null);

// Delete confirmation
const confirmDeleteUser = ref<string | null>(null);
const copiedToken = ref<string | null>(null);

const activeTab = ref<"users" | "invites" | "codes">("users");

async function loadUsers() {
  usersLoading.value = true;
  try {
    users.value = await api.listUsers();
  } catch {}
  usersLoading.value = false;
}

async function loadLinks() {
  linksLoading.value = true;
  try {
    magicLinks.value = await api.listMagicLinks();
  } catch {}
  linksLoading.value = false;
}

async function loadCodes() {
  codesLoading.value = true;
  try {
    inviteCodes.value = await api.listInviteCodes();
  } catch {}
  codesLoading.value = false;
}

async function handleCreateCode() {
  if (!newCodeLabel.value.trim()) return;
  creatingCode.value = true;
  createCodeError.value = null;
  try {
    const maxUses = newCodeMaxUses.value.trim() ? parseInt(newCodeMaxUses.value.trim(), 10) : null;
    if (maxUses !== null && (isNaN(maxUses) || maxUses < 1)) {
      createCodeError.value = "Max uses must be a positive number or empty for unlimited";
      creatingCode.value = false;
      return;
    }
    await api.createInviteCode({
      label: newCodeLabel.value.trim(),
      isAuthorized: newCodeAuthorized.value,
      maxUses,
    });
    newCodeLabel.value = "";
    newCodeMaxUses.value = "";
    newCodeAuthorized.value = true;
    await loadCodes();
  } catch (e: any) {
    createCodeError.value = e.message;
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

onMounted(() => {
  loadUsers();
  loadLinks();
  loadCodes();
});

async function toggleAuthorized(user: AdminUser) {
  try {
    await api.authorizeUser(user.id, !user.isAuthorized);
    await loadUsers();
  } catch {}
}

async function toggleAdmin(user: AdminUser) {
  try {
    await api.setUserAdmin(user.id, !user.isAdmin);
    await loadUsers();
  } catch {}
}

async function handleDeleteUser(userId: string) {
  try {
    await api.deleteUser(userId);
    confirmDeleteUser.value = null;
    await loadUsers();
  } catch {}
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
  } catch (e: any) {
    createError.value = e.message;
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

function linkStatus(link: MagicLink): "used" | "expired" | "pending" {
  if (link.usedAt) return "used";
  if (new Date(link.expiresAt) < new Date()) return "expired";
  return "pending";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
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
        </div>
        <div class="header-spacer" />
        <button class="close-btn" @click="emit('close')">&times;</button>
      </div>

      <!-- Users Tab -->
      <div v-if="activeTab === 'users'" class="admin-body">
        <div v-if="usersLoading" class="loading">Loading users...</div>
        <table v-else class="admin-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Password</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user.id">
              <td>
                <div class="user-cell">
                  <span class="user-name">{{ user.displayName }}</span>
                  <span class="user-email">{{ user.email }}</span>
                </div>
              </td>
              <td>
                <div class="role-badges">
                  <span v-if="user.isAdmin" class="badge badge-admin">Admin</span>
                  <span v-if="user.isAuthorized" class="badge badge-auth">Authorized</span>
                  <span v-if="!user.isAdmin && !user.isAuthorized" class="badge badge-free">Free</span>
                </div>
              </td>
              <td>
                <span :class="['pw-status', user.hasPassword ? 'pw-set' : 'pw-none']">
                  {{ user.hasPassword ? "Set" : "None" }}
                </span>
              </td>
              <td class="date-cell">{{ formatDate(user.createdAt) }}</td>
              <td>
                <div class="action-btns">
                  <button
                    class="action-btn"
                    :class="{ toggled: user.isAuthorized }"
                    @click="toggleAuthorized(user)"
                    title="Toggle authorized"
                  >Auth</button>
                  <button
                    class="action-btn"
                    :class="{ toggled: user.isAdmin }"
                    @click="toggleAdmin(user)"
                    title="Toggle admin"
                  >Admin</button>
                  <button
                    v-if="confirmDeleteUser !== user.id"
                    class="action-btn action-delete"
                    @click="confirmDeleteUser = user.id"
                  >Del</button>
                  <template v-else>
                    <button class="action-btn action-confirm" @click="handleDeleteUser(user.id)">Yes</button>
                    <button class="action-btn" @click="confirmDeleteUser = null">No</button>
                  </template>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Codes Tab -->
      <div v-if="activeTab === 'codes'" class="admin-body">
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

      <!-- Invites Tab -->
      <div v-if="activeTab === 'invites'" class="admin-body">
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
    </div>
  </div>
</template>

<style scoped>
.admin-overlay {
  position: fixed;
  inset: 0;
  background: rgba(10, 10, 20, 0.85);
  z-index: 200;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 48px;
  overflow-y: auto;
}

.admin-panel {
  background: #16213e;
  border: 1px solid #0f3460;
  border-radius: 8px;
  width: 900px;
  max-width: calc(100vw - 32px);
  margin-bottom: 48px;
  overflow: hidden;
}

/* Mobile: card layout instead of table */
@media (max-width: 767px) {
  .admin-overlay {
    padding-top: calc(16px + env(safe-area-inset-top, 0px));
  }

  .admin-panel {
    width: 100%;
    max-width: 100%;
    border-radius: 0;
    border-left: none;
    border-right: none;
    margin-bottom: 0;
    min-height: 100vh;
    min-height: 100dvh;
  }

  .admin-table {
    display: block;
  }

  .admin-table thead {
    display: none;
  }

  .admin-table tbody {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .admin-table tr {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 10px;
    padding: 10px;
    background: #1a1a2e;
    border-radius: 6px;
    border-bottom: none !important;
  }

  .admin-table td {
    padding: 0;
    border-bottom: none;
  }

  /* User name+email takes full width */
  .admin-table td:first-child {
    flex: 1 1 100%;
  }

  .date-cell {
    font-size: 11px;
  }

  .action-btns {
    margin-left: auto;
  }

  .action-btn {
    padding: 6px 12px;
    font-size: 12px;
  }

  .close-btn {
    width: 36px;
    height: 36px;
    font-size: 24px;
  }

  /* Invite form: stack vertically */
  .form-row {
    flex-direction: column;
  }

  .form-input {
    width: 100%;
  }

  .form-submit {
    width: 100%;
    padding: 10px;
  }

  .row-muted {
    opacity: 0.5;
  }
}

.admin-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  border-bottom: 1px solid #0f3460;
  background: #131b30;
}

.admin-title {
  font-size: 14px;
  font-weight: 700;
  color: #e94560;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  margin: 0;
}

.admin-tabs {
  display: flex;
  gap: 0;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid #0f3460;
}

.tab {
  padding: 4px 14px;
  background: #1a1a2e;
  border: none;
  color: #7f8fa6;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.tab:not(:last-child) {
  border-right: 1px solid #0f3460;
}

.tab.active {
  background: #e94560;
  color: white;
}

.header-spacer {
  flex: 1;
}

.close-btn {
  background: none;
  border: none;
  color: #7f8fa6;
  font-size: 20px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}

.close-btn:hover {
  color: #e94560;
}

.admin-body {
  padding: 16px;
}

.loading,
.empty-state {
  color: #7f8fa6;
  font-size: 13px;
  text-align: center;
  padding: 24px;
}

.admin-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.admin-table th {
  text-align: left;
  padding: 6px 10px;
  color: #7f8fa6;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
  border-bottom: 1px solid #0f3460;
}

.admin-table td {
  padding: 8px 10px;
  border-bottom: 1px solid rgba(15, 52, 96, 0.4);
  vertical-align: middle;
}

.admin-table tr:last-child td {
  border-bottom: none;
}

.row-muted {
  opacity: 0.5;
}

.user-cell {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.user-name {
  color: #e0e0e0;
  font-weight: 500;
  font-size: 13px;
}

.user-email {
  color: #7f8fa6;
  font-size: 11px;
}

.role-badges {
  display: flex;
  gap: 4px;
}

.badge {
  display: inline-block;
  padding: 1px 6px;
  font-size: 10px;
  font-weight: 600;
  border-radius: 3px;
  text-transform: uppercase;
}

.badge-admin {
  background: #e94560;
  color: white;
}

.badge-auth {
  background: #2ecc71;
  color: white;
}

.badge-free {
  background: #7f8fa6;
  color: white;
}

.badge-pending {
  background: #f39c12;
  color: white;
}

.badge-used {
  background: #2ecc71;
  color: white;
}

.badge-expired {
  background: #7f8fa6;
  color: white;
}

.pw-status {
  font-size: 11px;
  font-weight: 500;
}

.pw-set {
  color: #2ecc71;
}

.pw-none {
  color: #7f8fa6;
}

.date-cell {
  color: #7f8fa6;
  font-size: 12px;
  white-space: nowrap;
}

.action-btns {
  display: flex;
  gap: 4px;
}

.action-btn {
  padding: 2px 8px;
  background: #1a1a2e;
  border: 1px solid #0f3460;
  border-radius: 3px;
  color: #7f8fa6;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
}

.action-btn:hover {
  color: #e0e0e0;
  border-color: #7f8fa6;
}

.action-btn.toggled {
  background: #0f3460;
  color: #e0e0e0;
  border-color: #7fb3d3;
}

.action-delete {
  color: #e94560;
  border-color: rgba(233, 69, 96, 0.3);
}

.action-delete:hover {
  background: rgba(233, 69, 96, 0.15);
  color: #e94560;
  border-color: #e94560;
}

.action-confirm {
  color: #e94560;
  border-color: #e94560;
  background: rgba(233, 69, 96, 0.15);
}

.action-copied {
  color: #2ecc71;
  border-color: #2ecc71;
}

.code-value {
  font-family: monospace;
  font-size: 13px;
  color: #7fb3d3;
  background: #1a1a2e;
  padding: 2px 6px;
  border-radius: 3px;
  letter-spacing: 0.5px;
}

.use-count {
  font-size: 12px;
  color: #e0e0e0;
}

.form-input-sm {
  max-width: 180px;
}

/* Invite form */
.invite-form {
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #0f3460;
}

.section-title {
  font-size: 11px;
  font-weight: 600;
  color: #7f8fa6;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 10px 0;
}

.form-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.form-input {
  padding: 6px 10px;
  background: #1a1a2e;
  border: 1px solid #0f3460;
  border-radius: 4px;
  color: #e0e0e0;
  font-size: 13px;
  outline: none;
  flex: 1;
}

.form-input:focus {
  border-color: #e94560;
}

.form-checkbox {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #7f8fa6;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}

.form-checkbox input[type="checkbox"] {
  accent-color: #e94560;
}

.form-submit {
  padding: 6px 16px;
  background: #e94560;
  border: none;
  border-radius: 4px;
  color: white;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
  white-space: nowrap;
}

.form-submit:hover:not(:disabled) {
  background: #d13553;
}

.form-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.form-error {
  margin-top: 8px;
  background: rgba(233, 69, 96, 0.15);
  color: #e94560;
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 12px;
}
</style>
