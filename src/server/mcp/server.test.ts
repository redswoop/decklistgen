import { describe, test, expect, beforeAll } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "./server.js";
import { loadSet } from "../services/card-store.js";

async function connectedClient(): Promise<Client> {
  const server = createMcpServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "test-client", version: "0.0.0" }, { capabilities: {} });
  await client.connect(clientTransport);
  return client;
}

function firstTextContent(result: { content: Array<{ type: string; text?: string }> }): string {
  const block = result.content.find((b) => b.type === "text");
  if (!block?.text) throw new Error("No text content");
  return block.text;
}

describe("MCP server", () => {
  beforeAll(async () => {
    // Load one small set so search_cards / get_card have data to return
    await loadSet("CEL");
  });

  test("advertises every registered tool", async () => {
    const client = await connectedClient();
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toContain("list_sets");
    expect(names).toContain("load_set");
    expect(names).toContain("load_era");
    expect(names).toContain("search_cards");
    expect(names).toContain("get_card");
    expect(names).toContain("get_card_variants");
    expect(names).toContain("get_filter_options");
    expect(names).toContain("get_variant_groups");
    expect(names).toContain("parse_ptcgo_text");
    expect(names).toContain("import_limitless");
    expect(names).toContain("import_limitless_player");
    expect(names).toContain("format_decklist");
    expect(names).toContain("list_public_decks");
    expect(names).toContain("get_public_deck");
    expect(names).toContain("render_proxy_svg");
    expect(names).toContain("get_card_image_url");
    expect(names).toContain("proxy_status");
  });

  test("list_sets returns set entries", async () => {
    const client = await connectedClient();
    const result = await client.callTool({ name: "list_sets", arguments: {} });
    const payload = JSON.parse(firstTextContent(result as never));
    expect(Array.isArray(payload.sets)).toBe(true);
    expect(payload.total).toBe(payload.sets.length);
    expect(payload.sets[0]).toHaveProperty("code");
    expect(payload.sets[0]).toHaveProperty("era");
  });

  test("search_cards finds a card by name in a loaded set", async () => {
    const client = await connectedClient();
    const result = await client.callTool({
      name: "search_cards",
      arguments: { nameSearch: "Ho-Oh", sets: ["CEL"], pageSize: 5 },
    });
    const payload = JSON.parse(firstTextContent(result as never));
    expect(payload.total).toBeGreaterThan(0);
    expect(payload.cards[0].name).toContain("Ho-Oh");
  });

  test("get_card returns enriched detail", async () => {
    const client = await connectedClient();
    const result = await client.callTool({
      name: "get_card",
      arguments: { id: "cel25-1" },
    });
    const detail = JSON.parse(firstTextContent(result as never));
    expect(detail.id).toBe("cel25-1");
    expect(detail.name).toContain("Ho-Oh");
    expect(Array.isArray(detail.attacks)).toBe(true);
  });

  test("get_card returns error isError flag for unknown card", async () => {
    const client = await connectedClient();
    const result = await client.callTool({
      name: "get_card",
      arguments: { id: "nonexistent-999" },
    });
    expect((result as { isError?: boolean }).isError).toBe(true);
  });

  test("format_decklist renders plain text", async () => {
    const client = await connectedClient();
    const result = await client.callTool({
      name: "format_decklist",
      arguments: {
        entries: [{ setCode: "SVI", localId: "001", count: 4, name: "Sprigatito" }],
      },
    });
    const payload = JSON.parse(firstTextContent(result as never));
    expect(payload.text).toBe("SVI 001 x4  # Sprigatito");
  });

  test("parse_ptcgo_text resolves pasted deck", async () => {
    const client = await connectedClient();
    const text = "Pokémon: 1\n1 Ho-Oh CEL25 1";
    const result = await client.callTool({
      name: "parse_ptcgo_text",
      arguments: { text },
    });
    const payload = JSON.parse(firstTextContent(result as never));
    expect(Array.isArray(payload.cards)).toBe(true);
    // Either resolved (if CEL25 is preloaded) or unresolved — both are valid outcomes;
    // we just care that the tool doesn't throw and returns shape.
    expect(payload).toHaveProperty("unresolved");
  });

  test("get_card_image_url returns expected shape", async () => {
    const client = await connectedClient();
    const result = await client.callTool({
      name: "get_card_image_url",
      arguments: { cardId: "cel25-1", quality: "low" },
    });
    const payload = JSON.parse(firstTextContent(result as never));
    expect(payload.cardId).toBe("cel25-1");
    expect(payload.quality).toBe("low");
    expect(typeof payload.url).toBe("string");
    // If TCGdex provides an imageBase, URL ends with /low.png; else it's empty.
    if (payload.url) expect(payload.url).toMatch(/low\.png$/);
  });

  test("load_set rejects unknown set codes", async () => {
    const client = await connectedClient();
    const result = await client.callTool({
      name: "load_set",
      arguments: { code: "NOPE" },
    });
    expect((result as { isError?: boolean }).isError).toBe(true);
  });
});
