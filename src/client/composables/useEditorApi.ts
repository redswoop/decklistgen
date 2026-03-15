import type { CardTemplate } from "../../shared/types/template.js";

const BASE = "/gallery/editor";
const TMPL = `${BASE}/templates`;

export interface TemplateSummary {
  id: string;
  name: string;
  description?: string;
}

export interface CardEntry {
  id: string;
  category?: string;
  name?: string;
  suggestedTemplate?: string;
}

export function useEditorApi() {
  async function fetchCards(): Promise<CardEntry[]> {
    const resp = await fetch(`${BASE}/cards`);
    if (!resp.ok) return [];
    return resp.json();
  }

  async function fetchCardData(cardId: string): Promise<Record<string, unknown> | null> {
    const resp = await fetch(`${BASE}/card-data?cardId=${encodeURIComponent(cardId)}`);
    if (!resp.ok) return null;
    return resp.json();
  }

  async function renderSvg(cardId: string, elements: unknown[]): Promise<string> {
    const resp = await fetch(`${BASE}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId, elements }),
    });
    if (!resp.ok) throw new Error(resp.statusText);
    return resp.text();
  }

  function rawImageUrl(cardId: string): string {
    return `${BASE}/raw-image?cardId=${encodeURIComponent(cardId)}`;
  }

  // ── Template API ──

  async function listTemplates(): Promise<TemplateSummary[]> {
    const resp = await fetch(TMPL);
    if (!resp.ok) return [];
    return resp.json();
  }

  async function loadTemplate(id: string): Promise<CardTemplate | null> {
    const resp = await fetch(`${TMPL}/${encodeURIComponent(id)}`);
    if (!resp.ok) return null;
    return resp.json();
  }

  async function saveTemplate(template: CardTemplate): Promise<boolean> {
    const resp = await fetch(`${TMPL}/${encodeURIComponent(template.id)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(template),
    });
    return resp.ok;
  }

  async function deleteTemplate(id: string): Promise<boolean> {
    const resp = await fetch(`${TMPL}/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    return resp.ok;
  }

  return { fetchCards, fetchCardData, renderSvg, rawImageUrl, listTemplates, loadTemplate, saveTemplate, deleteTemplate };
}
