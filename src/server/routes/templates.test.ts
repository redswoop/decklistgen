import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { Hono } from "hono";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createTemplateRouter } from "./templates.js";

// Use a temp directory for test isolation
const TEST_DIR = join(import.meta.dir, "../../../cache/_test_templates");

const app = new Hono();
app.route("/templates", createTemplateRouter(TEST_DIR));

beforeAll(async () => {
  await mkdir(TEST_DIR, { recursive: true });
});

afterAll(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

describe("template CRUD", () => {
  const testTemplate = {
    name: "Test Pokemon",
    description: "A test template",
    elements: [
      {
        type: "box",
        id: "test-box",
        props: { anchorX: 0, anchorY: 0, direction: "row" },
        children: [
          { type: "text", props: { text: "Hello", fontSize: 24 } },
        ],
      },
    ],
  };

  test("POST creates template", async () => {
    const res = await app.request("/templates/test-crud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testTemplate),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.id).toBe("test-crud");
  });

  test("GET /:id returns saved template", async () => {
    const res = await app.request("/templates/test-crud");
    expect(res.status).toBe(200);
    const tmpl = await res.json();
    expect(tmpl.id).toBe("test-crud");
    expect(tmpl.name).toBe("Test Pokemon");
    expect(tmpl.elements).toHaveLength(1);
    expect(tmpl.elements[0].id).toBe("test-box");
  });

  test("GET / lists templates", async () => {
    const res = await app.request("/templates");
    expect(res.status).toBe(200);
    const list = await res.json();
    expect(Array.isArray(list)).toBe(true);
    const found = list.find((t: { id: string }) => t.id === "test-crud");
    expect(found).toBeDefined();
    expect(found.name).toBe("Test Pokemon");
  });

  test("POST rejects invalid id", async () => {
    const res = await app.request("/templates/bad id!", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testTemplate),
    });
    expect(res.status).toBe(400);
  });

  test("POST rejects missing name", async () => {
    const res = await app.request("/templates/test-bad", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ elements: [] }),
    });
    expect(res.status).toBe(400);
  });

  test("GET /:id returns 404 for missing", async () => {
    const res = await app.request("/templates/nonexistent");
    expect(res.status).toBe(404);
  });

  test("DELETE removes template", async () => {
    const res = await app.request("/templates/test-crud", {
      method: "DELETE",
    });
    expect(res.status).toBe(200);

    const getRes = await app.request("/templates/test-crud");
    expect(getRes.status).toBe(404);
  });

  test("DELETE returns 404 for missing", async () => {
    const res = await app.request("/templates/nonexistent", {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
  });
});

describe("path traversal protection", () => {
  test("GET /:id rejects path traversal", async () => {
    const res = await app.request("/templates/..%2Fsecrets");
    expect(res.status).toBe(400);
  });

  test("POST /:id rejects path traversal", async () => {
    const res = await app.request("/templates/..%2Fsecrets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "evil", elements: [] }),
    });
    expect(res.status).toBe(400);
  });

  test("DELETE /:id rejects path traversal", async () => {
    const res = await app.request("/templates/..%2Fsecrets", {
      method: "DELETE",
    });
    expect(res.status).toBe(400);
  });

  test("GET /:id rejects dots in id", async () => {
    const res = await app.request("/templates/foo.bar");
    expect(res.status).toBe(400);
  });
});
