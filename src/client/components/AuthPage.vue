<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useAuth } from "../composables/useAuth.js";
import { api } from "../lib/client.js";

const emit = defineEmits<{
  (e: "authenticated"): void;
}>();

const { needsSetup, error, login, register, redeemMagicLink, setup } = useAuth();

const mode = ref<"login" | "register" | "magic" | "invite">(needsSetup.value ? "login" : "login");
const email = ref("");
const password = ref("");
const displayName = ref("");
const registerInviteCode = ref("");
const submitting = ref(false);

// Magic link state
const magicToken = ref<string | null>(null);
const magicEmail = ref("");
const magicDisplayName = ref("");
const magicLoading = ref(false);
const magicError = ref<string | null>(null);

const inviteInput = ref("");

async function validateToken(token: string) {
  magicLoading.value = true;
  magicError.value = null;
  try {
    const info = await api.validateMagicLink(token);
    magicToken.value = token;
    magicEmail.value = info.email;
    magicDisplayName.value = info.displayName;
    mode.value = "magic";
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("410")) magicError.value = "This link has expired or already been used.";
    else if (msg.includes("404")) magicError.value = "Invalid invite code.";
    else magicError.value = "Could not validate invite code.";
  } finally {
    magicLoading.value = false;
  }
}

function extractToken(input: string): string {
  // Accept full URL (/magic/TOKEN, ?magic=TOKEN) or just the token
  const urlMatch = input.match(/\/magic\/([a-f0-9]+)/);
  if (urlMatch) return urlMatch[1];
  const paramMatch = input.match(/[?&]magic=([a-f0-9]+)/);
  if (paramMatch) return paramMatch[1];
  return input.trim();
}

async function handleInviteSubmit() {
  const token = extractToken(inviteInput.value);
  if (!token) return;
  await validateToken(token);
}

onMounted(async () => {
  // Check URL for magic link token: /magic/TOKEN or ?magic=TOKEN
  const path = window.location.pathname;
  const magicMatch = path.match(/^\/magic\/([a-f0-9]+)$/);
  const token = magicMatch?.[1] || new URLSearchParams(window.location.search).get("magic");

  if (token) {
    await validateToken(token);
  }
});

async function handleSubmit() {
  submitting.value = true;
  error.value = null;
  try {
    if (needsSetup.value) {
      await setup(email.value, password.value, displayName.value);
    } else if (mode.value === "magic" && magicToken.value) {
      await redeemMagicLink(magicToken.value, password.value);
      // Clean up URL
      window.history.replaceState({}, "", "/");
    } else if (mode.value === "register") {
      await register(email.value, password.value, displayName.value, registerInviteCode.value || undefined);
    } else {
      await login(email.value, password.value);
    }
    emit("authenticated");
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

      <!-- Magic link loading -->
      <div v-if="magicLoading" class="auth-notice">
        Validating your invite link...
      </div>

      <!-- Magic link error (bad/expired link) -->
      <div v-if="magicError" class="auth-error" style="margin-bottom: 16px;">
        {{ magicError }}
      </div>

      <!-- Magic link mode -->
      <template v-if="mode === 'magic' && magicToken && !magicLoading && !magicError">
        <div class="auth-notice">
          Welcome, {{ magicDisplayName }}! Set a password to complete your account.
        </div>
        <form class="auth-form" @submit.prevent="handleSubmit">
          <div class="auth-field">
            <label>Email</label>
            <input :value="magicEmail" type="email" disabled />
          </div>
          <div class="auth-field">
            <label>Password</label>
            <input
              v-model="password"
              type="password"
              placeholder="Min 8 characters"
              required
              minlength="8"
              autocomplete="new-password"
            />
          </div>
          <div v-if="error" class="auth-error">{{ error }}</div>
          <button class="auth-submit" type="submit" :disabled="submitting">
            {{ submitting ? "..." : "Create Account" }}
          </button>
        </form>
      </template>

      <!-- Invite code entry -->
      <template v-else-if="mode === 'invite' && !magicLoading">
        <div class="auth-notice">Paste your invite code or link below.</div>
        <form class="auth-form" @submit.prevent="handleInviteSubmit">
          <div class="auth-field">
            <label>Invite Code</label>
            <input
              v-model="inviteInput"
              type="text"
              placeholder="Paste code or link"
              required
              autocomplete="off"
            />
          </div>
          <div v-if="magicError" class="auth-error">{{ magicError }}</div>
          <button class="auth-submit" type="submit" :disabled="magicLoading">
            {{ magicLoading ? "..." : "Continue" }}
          </button>
        </form>
      </template>

      <!-- Normal login / register / setup -->
      <template v-else-if="!magicLoading">
        <form class="auth-form" @submit.prevent="handleSubmit">
          <div v-if="needsSetup || mode === 'register'" class="auth-field">
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
              :autocomplete="mode === 'register' ? 'new-password' : 'current-password'"
            />
          </div>
          <div v-if="mode === 'register'" class="auth-field">
            <label>Invite Code <span class="field-hint">(optional)</span></label>
            <input
              v-model="registerInviteCode"
              type="text"
              placeholder="Enter code if you have one"
              autocomplete="off"
            />
          </div>

          <div v-if="error" class="auth-error">{{ error }}</div>

          <button class="auth-submit" type="submit" :disabled="submitting">
            {{ submitting ? "..." : needsSetup ? "Create Admin Account" : mode === "register" ? "Create Account" : "Log In" }}
          </button>
        </form>
      </template>

      <!-- Toggle links (always visible when not in setup/magic/loading) -->
      <div v-if="!needsSetup && !magicLoading && mode !== 'magic'" class="auth-toggle">
        <template v-if="mode === 'invite'">
          <button class="auth-toggle-btn" @click="mode = 'login'; magicError = null; error = null">Back to Log In</button>
        </template>
        <template v-else>
          <template v-if="mode === 'login'">
            Don't have an account?
            <button class="auth-toggle-btn" @click="mode = 'register'; error = null">Register</button>
          </template>
          <template v-else-if="mode === 'register'">
            Already have an account?
            <button class="auth-toggle-btn" @click="mode = 'login'; error = null">Log In</button>
          </template>
          <span class="auth-divider">·</span>
          Have an invite?
          <button class="auth-toggle-btn" @click="mode = 'invite'; error = null">Enter code</button>
        </template>
      </div>
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

.auth-field input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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

.auth-toggle {
  text-align: center;
  margin-top: 16px;
  font-size: 12px;
  color: #7f8fa6;
}

.auth-toggle-btn {
  background: none;
  border: none;
  color: #e94560;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: underline;
  padding: 0;
}

.auth-toggle-btn:hover {
  color: #d13553;
}

.auth-divider {
  margin: 0 4px;
}

.field-hint {
  font-weight: 400;
  opacity: 0.6;
  text-transform: none;
  letter-spacing: 0;
}
</style>
