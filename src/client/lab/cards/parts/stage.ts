import type { Stage } from "../../types";

/*
 * Real Pokémon cards put a small plaque in the top-left that reads
 * "BASIC", "STAGE 1", or "STAGE 2". TCGdex hands us the same field as
 * "Basic" / "Stage1" / "Stage2" (no space). This helper handles both
 * the spacing fix and the uppercase, in one place, so the component
 * stays stupid and the formatting is testable as a pure function.
 */
export function formatStageLabel(stage: Stage): string {
  return stage.replace(/^Stage(\d)$/i, "Stage $1").toUpperCase();
}

const SHOWABLE: ReadonlySet<string> = new Set(["basic", "stage1", "stage2"]);

/*
 * Only Basic / Stage 1 / Stage 2 get the plaque. VMAX, VSTAR, and (when
 * we model them) Mega Evolution use distinct header treatments on real
 * cards — handled separately, not via this pill.
 */
export function isShowableStage(stage: string | undefined): stage is Stage {
  return !!stage && SHOWABLE.has(stage.toLowerCase());
}
