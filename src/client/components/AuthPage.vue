<script setup lang="ts">
import { ref } from "vue";
import { useAuth } from "../composables/useAuth.js";

const { needsSetup, error, login, signup, setup } = useAuth();

const mode = ref<"login" | "signup">(needsSetup.value ? "setup" : "login");
const email = ref("");
const password = ref("");
const displayName = ref("");
const inviteCode = ref("");
const submitting = ref(false);

async function handleSubmit() {
  submitting.value = true;
  error.value = null;
  try {
    if (needsSetup.value) {
      await setup(email.value, password.value, displayName.value);
    } else if (mode.value === "login") {
      await login(email.value, password.value);
    } else {
      await signup(email.value, password.value, displayName.value, inviteCode.value);
    }
  } catch {
    // error already set by useAuth
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <h1 class="auth-title">DecklistGen</h1>

      <div v-if="needsSetup" class="auth-notice">
        First time setup — create your admin account.
      </div>

      <div v-if="!needsSetup" class="auth-tabs">
        <button
          :class="['auth-tab', { active: mode === 'login' }]"
          @click="mode = 'login'; error = null"
        >Log In</button>
        <button
          :class="['auth-tab', { active: mode === 'signup' }]"
          @click="mode = 'signup'; error = null"
        >Sign Up</button>
      </div>

      <form class="auth-form" @submit.prevent="handleSubmit">
        <div v-if="mode === 'signup' || needsSetup" class="auth-field">
          <label>Display Name</label>
          <input
            v-model="displayName"
            type="text"
            placeholder="Your name"
            required
            autocomplete="name"
          />
        </div>
        <div class="auth-field">
          <label>Email</label>
          <input
            v-model="email"
            type="email"
            placeholder="you@example.com"
            required
            autocomplete="email"
          />
        </div>
        <div class="auth-field">
          <label>Password</label>
          <input
            v-model="password"
            type="password"
            placeholder="Min 8 characters"
            required
            minlength="8"
            autocomplete="current-password"
          />
        </div>
        <div v-if="mode === 'signup' && !needsSetup" class="auth-field">
          <label>Invite Code</label>
          <input
            v-model="inviteCode"
            type="text"
            placeholder="Enter your invite code"
            required
          />
        </div>

        <div v-if="error" class="auth-error">{{ error }}</div>

        <button class="auth-submit" type="submit" :disabled="submitting">
          {{ submitting ? "..." : needsSetup ? "Create Admin Account" : mode === "login" ? "Log In" : "Sign Up" }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: #1a1a2e;
}

.auth-card {
  background: #16213e;
  border: 1px solid #0f3460;
  border-radius: 8px;
  padding: 32px;
  width: 360px;
}

.auth-title {
  font-size: 20px;
  font-weight: 700;
  color: #e94560;
  text-transform: uppercase;
  letter-spacing: 2px;
  text-align: center;
  margin-bottom: 24px;
}

.auth-notice {
  background: #0f3460;
  color: #7fb3d3;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 12px;
  margin-bottom: 16px;
  text-align: center;
}

.auth-tabs {
  display: flex;
  gap: 0;
  margin-bottom: 20px;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid #0f3460;
}

.auth-tab {
  flex: 1;
  padding: 6px 0;
  background: #1a1a2e;
  border: none;
  color: #7f8fa6;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.auth-tab:not(:last-child) {
  border-right: 1px solid #0f3460;
}

.auth-tab.active {
  background: #e94560;
  color: white;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.auth-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.auth-field label {
  font-size: 11px;
  color: #7f8fa6;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.auth-field input {
  padding: 8px 10px;
  background: #1a1a2e;
  border: 1px solid #0f3460;
  border-radius: 4px;
  color: #e0e0e0;
  font-size: 13px;
  outline: none;
}

.auth-field input:focus {
  border-color: #e94560;
}

.auth-error {
  background: rgba(233, 69, 96, 0.15);
  color: #e94560;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 12px;
}

.auth-submit {
  padding: 10px;
  background: #e94560;
  border: none;
  border-radius: 4px;
  color: white;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
  margin-top: 4px;
}

.auth-submit:hover:not(:disabled) {
  background: #d13553;
}

.auth-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
