<script setup lang="ts">
// Admin → Users tab. Self-contained: owns its list + delete-confirm state and
// the authorize/admin/delete mutations. Styling comes from the namespaced
// .admin-overlay rules in styles/admin.css.
import { ref, onMounted } from "vue";
import { api } from "../../lib/client.js";
import type { AdminUser } from "../../../shared/types/user.js";
import { formatDate } from "../../lib/date-format.js";

const users = ref<AdminUser[]>([]);
const usersLoading = ref(true);
const confirmDeleteUser = ref<string | null>(null);

async function loadUsers() {
  usersLoading.value = true;
  try {
    users.value = await api.listUsers();
  } catch {}
  usersLoading.value = false;
}

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

onMounted(loadUsers);
</script>

<template>
  <div class="admin-body">
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
</template>
