import { describe, it, expect } from "bun:test";
import { filterGalleryCards, countByTemplate } from "./gallery-filter.js";
import type { TemplateName } from "../composables/useGalleryCardSource.js";

interface Row {
  name: string;
  cardId: string;
  template: TemplateName;
}
const templateOf = (r: Row) => r.template;

const ROWS: Row[] = [
  { name: "Pikachu", cardId: "svi-001", template: "pokemon-fullart" },
  { name: "Raichu", cardId: "svi-002", template: "pokemon-standard" },
  { name: "Fire Energy", cardId: "svi-100", template: "basic-energy" },
  { name: "Professor's Research", cardId: "svi-200", template: "trainer" },
];

describe("countByTemplate", () => {
  it("buckets every template, zero-filling the rest", () => {
    const counts = countByTemplate(ROWS, templateOf);
    expect(counts["pokemon-fullart"]).toBe(1);
    expect(counts["pokemon-standard"]).toBe(1);
    expect(counts["basic-energy"]).toBe(1);
    expect(counts["trainer"]).toBe(1);
    expect(counts["pokemon-vstar"]).toBe(0);
  });
});

describe("filterGalleryCards", () => {
  it("returns all cards with the 'all' filter and empty search", () => {
    expect(filterGalleryCards(ROWS, { templateFilter: "all", search: "" }, templateOf)).toHaveLength(4);
  });

  it("narrows by template bucket", () => {
    const out = filterGalleryCards(ROWS, { templateFilter: "trainer", search: "" }, templateOf);
    expect(out.map((r) => r.name)).toEqual(["Professor's Research"]);
  });

  it("searches name and id case-insensitively", () => {
    expect(filterGalleryCards(ROWS, { templateFilter: "all", search: "RAICHU" }, templateOf)).toHaveLength(1);
    expect(filterGalleryCards(ROWS, { templateFilter: "all", search: "svi-100" }, templateOf)[0].name).toBe("Fire Energy");
  });

  it("combines template and search filters", () => {
    expect(filterGalleryCards(ROWS, { templateFilter: "pokemon-standard", search: "pika" }, templateOf)).toHaveLength(0);
    expect(filterGalleryCards(ROWS, { templateFilter: "pokemon-fullart", search: "pika" }, templateOf)).toHaveLength(1);
  });

  it("does not mutate the input array", () => {
    const input = ROWS.slice();
    filterGalleryCards(input, { templateFilter: "trainer", search: "" }, templateOf);
    expect(input).toHaveLength(4);
  });
});
