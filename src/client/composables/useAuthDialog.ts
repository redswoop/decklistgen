import { ref } from "vue";

const showAuthDialog = ref(false);

export function useAuthDialog() {
  return {
    showAuthDialog,
    openAuthDialog: () => { showAuthDialog.value = true; },
    closeAuthDialog: () => { showAuthDialog.value = false; },
  };
}
