import { ref, computed, watch, onUnmounted, type Ref } from "vue";

type ViewName = string;

const LAYOUT_KEY = "decklistgen-layout";

interface LayoutState {
  left: number;
  right: number;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
}

const defaults: LayoutState = { left: 15, right: 15, leftCollapsed: false, rightCollapsed: false };

function loadLayout(): LayoutState {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {}
  return { ...defaults };
}

function saveLayout(partial: Partial<LayoutState>) {
  const current = loadLayout();
  Object.assign(current, partial);
  localStorage.setItem(LAYOUT_KEY, JSON.stringify(current));
}

/**
 * App shell layout: persisted sidebar widths + collapse state, drag-to-resize,
 * and the mobile slide-over open state. The left sidebar exists only on the
 * 'cards' view, the right only on 'browse'; both are forced collapsed on mobile.
 */
export function useLayoutControl(currentView: Ref<ViewName>, isMobile: Ref<boolean>) {
  const saved = loadLayout();

  const mobileLeftOpen = ref(false);
  const mobileRightOpen = ref(false);

  const leftPanelLabel = computed(() => "Filters");
  const rightPanelLabel = computed(() => (currentView.value === "browse" ? "Deck" : "Filters"));

  // Close mobile panels on tab switch.
  watch(currentView, () => {
    if (isMobile.value) {
      mobileLeftOpen.value = false;
      mobileRightOpen.value = false;
    }
  });

  // Lock body scroll when a mobile panel is open.
  watch([mobileLeftOpen, mobileRightOpen], ([left, right]) => {
    document.body.style.overflow = left || right ? "hidden" : "";
  });

  const savedLeftCollapsed = ref(saved.leftCollapsed);
  const savedRightCollapsed = ref(saved.rightCollapsed);
  const leftCollapsed = computed(() =>
    isMobile.value || savedLeftCollapsed.value || currentView.value !== "cards",
  );
  const rightCollapsed = computed(() =>
    isMobile.value || savedRightCollapsed.value || currentView.value !== "browse",
  );
  const leftPct = ref(saved.left);
  const rightPct = ref(saved.right);

  // --- Drag-to-resize ---
  const dragging = ref<"left" | "right" | null>(null);
  let dragStartX = 0;
  let dragStartPct = 0;

  function startDrag(side: "left" | "right", e: MouseEvent) {
    if (isMobile.value) return;
    e.preventDefault();
    dragging.value = side;
    dragStartX = e.clientX;
    dragStartPct = side === "left" ? leftPct.value : rightPct.value;
    document.addEventListener("mousemove", onDragMove);
    document.addEventListener("mouseup", onDragEnd);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  function onDragMove(e: MouseEvent) {
    const container = document.querySelector(".layout") as HTMLElement | null;
    if (!container) return;
    const totalWidth = container.clientWidth;
    const dx = e.clientX - dragStartX;
    const dPct = (dx / totalWidth) * 100;
    if (dragging.value === "left") {
      leftPct.value = Math.max(10, Math.min(40, dragStartPct + dPct));
    } else {
      rightPct.value = Math.max(10, Math.min(40, dragStartPct - dPct));
    }
  }

  function onDragEnd() {
    dragging.value = null;
    document.removeEventListener("mousemove", onDragMove);
    document.removeEventListener("mouseup", onDragEnd);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    saveLayout({ left: leftPct.value, right: rightPct.value });
  }

  onUnmounted(() => {
    document.removeEventListener("mousemove", onDragMove);
    document.removeEventListener("mouseup", onDragEnd);
  });

  function collapseLeft() {
    if (isMobile.value) { mobileLeftOpen.value = false; return; }
    savedLeftCollapsed.value = true;
    saveLayout({ leftCollapsed: true });
  }
  function collapseRight() {
    if (isMobile.value) { mobileRightOpen.value = false; return; }
    savedRightCollapsed.value = true;
    saveLayout({ rightCollapsed: true });
  }
  function expandLeft() {
    savedLeftCollapsed.value = false;
    saveLayout({ leftCollapsed: false });
  }
  function expandRight() {
    savedRightCollapsed.value = false;
    saveLayout({ rightCollapsed: false });
  }

  function toggleMobileLeft() {
    mobileRightOpen.value = false;
    mobileLeftOpen.value = !mobileLeftOpen.value;
  }
  function toggleMobileRight() {
    mobileLeftOpen.value = false;
    mobileRightOpen.value = !mobileRightOpen.value;
  }

  return {
    mobileLeftOpen, mobileRightOpen, leftPanelLabel, rightPanelLabel,
    leftCollapsed, rightCollapsed, leftPct, rightPct, dragging,
    startDrag, collapseLeft, collapseRight, expandLeft, expandRight,
    toggleMobileLeft, toggleMobileRight,
  };
}
