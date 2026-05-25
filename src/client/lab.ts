import { createApp } from "vue";
import Lab from "./lab/Lab.vue";
import "./lab/themes/_fonts.css";          // @font-face declarations — load first
import "./lab/themes/default-fullart.css";
import "./lab/themes/noir-fullart.css";

createApp(Lab).mount("#lab-root");
