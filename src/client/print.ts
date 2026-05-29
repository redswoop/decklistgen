import { createApp } from "vue";
import PrintSheet from "./print/PrintSheet.vue";
import "./lab/themes/_fonts.css";          // @font-face declarations — load first
import "./lab/themes/default-fullart.css";

createApp(PrintSheet).mount("#print-root");
