import { createApp } from "vue";
import { VueQueryPlugin } from "@tanstack/vue-query";
import App from "./App.vue";
import "./styles/globals.css";
// CSS card renderer (lab) — font faces and the default theme's CSS variable
// block. Scoped to .theme-default-fullart so it only applies where a consumer
// opts in (currently CssCardRenderer.vue).
import "./lab/themes/_fonts.css";
import "./lab/themes/default-fullart.css";

const app = createApp(App);
app.use(VueQueryPlugin, {
  queryClientConfig: {
    defaultOptions: { queries: { staleTime: 60_000 } },
  },
});
app.mount("#root");
