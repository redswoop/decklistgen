import { describe, test, expect, beforeEach } from "bun:test";
import { useEditorViewport } from "./useEditorViewport.js";

describe("useEditorViewport", () => {
  let viewport: ReturnType<typeof useEditorViewport>;

  beforeEach(() => {
    viewport = useEditorViewport();
    // Reset to defaults
    viewport.zoomLevel.value = 0.55;
    viewport.panX.value = 0;
    viewport.panY.value = 0;
  });

  describe("setZoom", () => {
    test("sets zoom from percentage", () => {
      viewport.setZoom(100);
      expect(viewport.zoomLevel.value).toBe(1);
    });

    test("clamps zoom to minimum 0.2", () => {
      viewport.setZoom(5);
      expect(viewport.zoomLevel.value).toBe(0.2);
    });

    test("clamps zoom to maximum 2.0", () => {
      viewport.setZoom(300);
      expect(viewport.zoomLevel.value).toBe(2);
    });
  });

  describe("zoomPercent", () => {
    test("returns rounded percentage", () => {
      viewport.zoomLevel.value = 0.55;
      expect(viewport.zoomPercent.value).toBe(55);
    });

    test("rounds to nearest integer", () => {
      viewport.zoomLevel.value = 0.333;
      expect(viewport.zoomPercent.value).toBe(33);
    });
  });

  describe("transform", () => {
    test("reflects current values", () => {
      viewport.zoomLevel.value = 1.5;
      viewport.panX.value = 100;
      viewport.panY.value = -50;
      expect(viewport.transform.value).toEqual({ zoom: 1.5, panX: 100, panY: -50 });
    });
  });
});
