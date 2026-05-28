import { describe, expect, test } from "bun:test";
import { gridForPaper } from "./print-grid.js";

describe("gridForPaper", () => {
  test("letter portrait fits 3x3", () => {
    const g = gridForPaper("letter", "portrait");
    expect(g.cols).toBe(3);
    expect(g.rows).toBe(3);
    expect(g.cardsPerSheet).toBe(9);
  });

  test("letter landscape fits 4x2", () => {
    const g = gridForPaper("letter", "landscape");
    expect(g.cols).toBe(4);
    expect(g.rows).toBe(2);
    expect(g.cardsPerSheet).toBe(8);
  });

  test("super-b portrait fits 5x5", () => {
    const g = gridForPaper("super-b", "portrait");
    expect(g.cols).toBe(5);
    expect(g.rows).toBe(5);
    expect(g.cardsPerSheet).toBe(25);
  });

  test("super-b landscape fits 7x3", () => {
    const g = gridForPaper("super-b", "landscape");
    expect(g.cols).toBe(7);
    expect(g.rows).toBe(3);
    expect(g.cardsPerSheet).toBe(21);
  });

  test("returns page and usable dimensions", () => {
    const g = gridForPaper("letter", "portrait");
    expect(g.pageW).toBe(8.5);
    expect(g.pageH).toBe(11);
    expect(g.usableW).toBe(8);
    expect(g.usableH).toBe(10.5);
  });
});
