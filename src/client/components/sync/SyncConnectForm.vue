<script setup lang="ts">
// Connect phase of the deck-sync wizard. Credentials are two-way bound to the
// useSyncDecks composable (so they survive a Back from the pick phase, password
// excepted). Styling: namespaced .sync-panel rules in styles/sync.css.
const url = defineModel<string>("url", { required: true });
const email = defineModel<string>("email", { required: true });
const password = defineModel<string>("password", { required: true });

defineProps<{
  connecting: boolean;
  error: string | null;
}>();

const emit = defineEmits<{ connect: [] }>();
</script>

<template>
  <div class="sync-section">
    <h3 class="section-title">Connect to a remote server</h3>
    <p class="hint">
      Log in to another DecklistGen instance with your credentials there. The password is
      used once to establish a session and is never stored.
    </p>
    <div class="form-stack">
      <label class="field">
        <span class="field-label">Server URL</span>
        <input
          v-model="url"
          type="text"
          placeholder="https://decklistgen.example.com"
          class="form-input"
          autocomplete="url"
          @keydown.enter="emit('connect')"
        />
      </label>
      <label class="field">
        <span class="field-label">Email</span>
        <input
          v-model="email"
          type="email"
          placeholder="you@example.com"
          class="form-input"
          autocomplete="username"
          @keydown.enter="emit('connect')"
        />
      </label>
      <label class="field">
        <span class="field-label">Password</span>
        <input
          v-model="password"
          type="password"
          placeholder="password on remote server"
          class="form-input"
          autocomplete="current-password"
          @keydown.enter="emit('connect')"
        />
      </label>
      <button
        class="form-submit"
        :disabled="connecting || !url.trim() || !email.trim() || !password"
        @click="emit('connect')"
      >{{ connecting ? "Connecting..." : "Connect" }}</button>
      <div v-if="error" class="form-error">{{ error }}</div>
    </div>
  </div>
</template>
