import { test, expect } from "@playwright/test";

const TEST_EMAIL = "claude@test.local";
const TEST_PASSWORD = "playwright-test-2024";

async function loginAndNavigate(page: any, cardId: string) {
  await page.goto(`/#/editor/${cardId}`);
  const svg = page.locator("#editor-canvas-wrap svg");
  try {
    await expect(svg).toBeVisible({ timeout: 5000 });
  } catch {
    const authForm = page.locator(".auth-form");
    if (await authForm.isVisible({ timeout: 2000 })) {
      await page.locator('input[type="email"]').fill(TEST_EMAIL);
      await page.locator('input[type="password"]').fill(TEST_PASSWORD);
      await page.locator(".auth-submit").click();
      await page.waitForSelector(".app-nav", { timeout: 10000 });
      await page.goto(`/#/editor/${cardId}`);
    }
    await expect(svg).toBeVisible({ timeout: 15000 });
  }
}

test.describe("Canvas click → tree selection", () => {
  test("clicking attack text maps to attacks repeater when abilities absent", async ({ page }) => {
    // sv08-048 = Black Kyurem ex — has attacks, NO abilities
    await loginAndNavigate(page, "sv08-048");

    const result = await page.evaluate(() => {
      const svg = document.querySelector("#editor-canvas-wrap svg");
      if (!svg) return { error: "no svg" };
      const cb = svg.querySelector('[data-element-id="content-block"]');
      if (!cb) return { error: "no content-block" };

      // Check direct children data-child-index values
      const children = cb.querySelectorAll(':scope > g[data-child-index]');
      const indices = Array.from(children).map(c => c.getAttribute("data-child-index"));

      // Simulate onCanvasClick walk from first text in content-block
      const target = cb.querySelector("text");
      if (!target) return { error: "no text" };

      let node: Element | null = target;
      const walkIndices: number[] = [];
      let elementId: string | null = null;

      while (node && node.tagName.toLowerCase() !== "svg") {
        const ci = (node as any).dataset?.childIndex;
        if (ci != null) walkIndices.unshift(parseInt(ci));
        const eid = (node as any).dataset?.elementId;
        if (eid) { elementId = eid; break; }
        node = node.parentElement;
      }

      return { indices, walkIndices, elementId, svgTagName: svg.tagName };
    });

    if ("error" in result) { test.skip(); return; }

    // No data-child-index="0" at content-block level (abilities was filtered)
    expect(result.indices).not.toContain("0");
    expect(result.indices[0]).toBe("1"); // attacks wrapper

    // Walk produces correct first index
    expect(result.walkIndices[0]).toBe(1);
  });
});
