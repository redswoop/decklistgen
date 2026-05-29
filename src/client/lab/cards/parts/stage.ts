import type { NameSuffix, Stage } from "../../types";

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
 * Only Basic / Stage 1 / Stage 2 are stage values that get the plaque.
 * VMAX and VSTAR also get the plaque but go through pillLabelForSuffix
 * below — the label is the suffix name itself rather than a stage.
 */
export function isShowableStage(stage: string | undefined): stage is Stage {
  return !!stage && SHOWABLE.has(stage.toLowerCase());
}

/*
 * VMAX and VSTAR cards display a stage-style plaque whose label is the
 * suffix itself ("VMAX" / "VSTAR"), regardless of evolution stage. ex
 * cards keep showing their actual stage; nothing overrides for them.
 */
export function pillLabelForSuffix(suffix: NameSuffix | undefined): string | null {
  return suffix === "VMAX" || suffix === "VSTAR" ? suffix : null;
}
