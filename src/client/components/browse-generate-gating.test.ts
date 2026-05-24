import { describe, test, expect } from "bun:test";
import {
  canConfirmGenerate,
  clampForAdmin,
  needsTypedConfirm,
} from "./browse-generate-gating.js";
import { MAX_GENERATE_BATCH_NON_ADMIN } from "../../shared/constants/generate-limits.js";

describe("browse-generate-gating", () => {
  describe("clampForAdmin", () => {
    test("admins are not clamped", () => {
      expect(clampForAdmin(true, 137)).toBe(137);
      expect(clampForAdmin(true, 0)).toBe(0);
    });

    test("non-admins are clamped to MAX_GENERATE_BATCH_NON_ADMIN", () => {
      expect(clampForAdmin(false, 137)).toBe(MAX_GENERATE_BATCH_NON_ADMIN);
      expect(clampForAdmin(false, 25)).toBe(25);
      expect(clampForAdmin(false, 5)).toBe(5);
    });
  });

  describe("needsTypedConfirm", () => {
    test("only admins with >25 effective need typed confirm", () => {
      expect(needsTypedConfirm(true, 26)).toBe(true);
      expect(needsTypedConfirm(true, 137)).toBe(true);
    });

    test("admins with <=25 do not need typed confirm", () => {
      expect(needsTypedConfirm(true, 25)).toBe(false);
      expect(needsTypedConfirm(true, 1)).toBe(false);
    });

    test("non-admins never need typed confirm (they're already clamped)", () => {
      expect(needsTypedConfirm(false, 25)).toBe(false);
      expect(needsTypedConfirm(false, 100)).toBe(false);
    });
  });

  describe("canConfirmGenerate", () => {
    test("disabled when effectiveCount is 0", () => {
      expect(
        canConfirmGenerate({
          effectiveCount: 0,
          actualCount: 0,
          isAdmin: false,
          typedConfirm: "",
        }),
      ).toBe(false);
    });

    test("non-admin with any positive effectiveCount can confirm immediately", () => {
      expect(
        canConfirmGenerate({
          effectiveCount: 1,
          actualCount: 1,
          isAdmin: false,
          typedConfirm: "",
        }),
      ).toBe(true);
      expect(
        canConfirmGenerate({
          effectiveCount: 25,
          actualCount: 99,
          isAdmin: false,
          typedConfirm: "",
        }),
      ).toBe(true);
    });

    test("admin with effectiveCount <= 25 can confirm immediately", () => {
      expect(
        canConfirmGenerate({
          effectiveCount: 25,
          actualCount: 25,
          isAdmin: true,
          typedConfirm: "",
        }),
      ).toBe(true);
      expect(
        canConfirmGenerate({
          effectiveCount: 10,
          actualCount: 10,
          isAdmin: true,
          typedConfirm: "",
        }),
      ).toBe(true);
    });

    test("admin with effectiveCount > 25 must type the exact number", () => {
      const base = { effectiveCount: 137, actualCount: 137, isAdmin: true };

      expect(canConfirmGenerate({ ...base, typedConfirm: "" })).toBe(false);
      expect(canConfirmGenerate({ ...base, typedConfirm: "13" })).toBe(false);
      expect(canConfirmGenerate({ ...base, typedConfirm: "138" })).toBe(false);
      expect(canConfirmGenerate({ ...base, typedConfirm: "137" })).toBe(true);
      expect(canConfirmGenerate({ ...base, typedConfirm: " 137 " })).toBe(true);
    });
  });
});
