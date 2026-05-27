import { describe, it, expect } from "bun:test";
import { formatStageLabel, isShowableStage } from "./stage";

describe("formatStageLabel", () => {
  it("uppercases Basic", () => {
    expect(formatStageLabel("Basic")).toBe("BASIC");
  });

  it("inserts a space and uppercases Stage1 / Stage2", () => {
    expect(formatStageLabel("Stage1")).toBe("STAGE 1");
    expect(formatStageLabel("Stage2")).toBe("STAGE 2");
  });
});

describe("isShowableStage", () => {
  it("accepts the three stages that get a pill", () => {
    expect(isShowableStage("Basic")).toBe(true);
    expect(isShowableStage("Stage1")).toBe(true);
    expect(isShowableStage("Stage2")).toBe(true);
  });

  it("rejects VMAX/VSTAR (they have distinct header treatments)", () => {
    expect(isShowableStage("VMAX")).toBe(false);
    expect(isShowableStage("VSTAR")).toBe(false);
  });

  it("rejects undefined and unknown values", () => {
    expect(isShowableStage(undefined)).toBe(false);
    expect(isShowableStage("")).toBe(false);
    expect(isShowableStage("Mega")).toBe(false);
  });
});
