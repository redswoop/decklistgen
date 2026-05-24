import { MAX_GENERATE_BATCH_NON_ADMIN } from "../../shared/constants/generate-limits.js";

export interface GatingInput {
  effectiveCount: number;
  actualCount: number;
  isAdmin: boolean;
  typedConfirm: string;
}

export function needsTypedConfirm(isAdmin: boolean, effectiveCount: number): boolean {
  return isAdmin && effectiveCount > MAX_GENERATE_BATCH_NON_ADMIN;
}

export function canConfirmGenerate(input: GatingInput): boolean {
  if (input.effectiveCount <= 0) return false;
  if (!needsTypedConfirm(input.isAdmin, input.effectiveCount)) return true;
  return input.typedConfirm.trim() === String(input.effectiveCount);
}

export function clampForAdmin(isAdmin: boolean, actualCount: number): number {
  if (isAdmin) return actualCount;
  return Math.min(actualCount, MAX_GENERATE_BATCH_NON_ADMIN);
}
