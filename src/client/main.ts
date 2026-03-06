import { createApp } from "vue";
import { VueQueryPlugin } from "@tanstack/vue-query";
import App from "./App.vue";
import "./styles/globals.css";

const app = createApp(App);
app.use(VueQueryPlugin, {
  queryClientConfig: {
    defaultOptions: { queries: { staleTime: 60_000 } },
  },
});
app.mount("#root");
