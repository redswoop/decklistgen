import { ref, computed } from "vue";
import { api } from "../lib/client.js";
import type { User } from "../../shared/types/user.js";

const currentUser = ref<User | null>(null);
const needsSetup = ref(false);
const loading = ref(true);
const error = ref<string | null>(null);

export function useAuth() {
  const isLoggedIn = computed(() => currentUser.value !== null);
  const isAdmin = computed(() => currentUser.value?.isAdmin === true);

  async function checkAuth() {
    loading.value = true;
    error.value = null;
    try {
      const result = await api.getMe();
      if ("needsSetup" in result && result.needsSetup) {
        needsSetup.value = true;
        currentUser.value = null;
      } else {
        currentUser.value = result as User;
        needsSetup.value = false;
      }
    } catch {
      currentUser.value = null;
    } finally {
      loading.value = false;
    }
  }

  async function login(email: string, password: string) {
    error.value = null;
    try {
      const user = await api.login({ email, password });
      currentUser.value = user;
      needsSetup.value = false;
    } catch (e: any) {
      error.value = e.message.includes("401") ? "Invalid email or password" : e.message;
      throw e;
    }
  }

  async function signup(email: string, password: string, displayName: string, inviteCode: string) {
    error.value = null;
    try {
      const user = await api.signup({ email, password, displayName, inviteCode });
      currentUser.value = user;
      needsSetup.value = false;
    } catch (e: any) {
      if (e.message.includes("409")) error.value = "Email already in use";
      else if (e.message.includes("400")) error.value = "Invalid invite code or missing fields";
      else error.value = e.message;
      throw e;
    }
  }

  async function setup(email: string, password: string, displayName: string) {
    error.value = null;
    try {
      const user = await api.setup({ email, password, displayName });
      currentUser.value = user;
      needsSetup.value = false;
    } catch (e: any) {
      error.value = e.message;
      throw e;
    }
  }

  async function logout() {
    try {
      await api.logout();
    } catch {}
    currentUser.value = null;
  }

  return {
    currentUser,
    needsSetup,
    loading,
    error,
    isLoggedIn,
    isAdmin,
    checkAuth,
    login,
    signup,
    setup,
    logout,
  };
}
