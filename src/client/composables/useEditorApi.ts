import type { CardTemplate, BuiltinEditMode } from "../../shared/types/template.js";

const BASE = "/gallery/editor";
const SETS = `${BASE}/sets`;

export interface TemplateSetSummary {
  id: string;
  name: string;
  description?: string;
  extends?: string;
  origin: "builtin" | "user";
  hasShadow?: boolean;
  slotIds: string[];
  cardIds: string[];
}

export interface TemplateSetPolicy {
  builtinEditMode: BuiltinEditMode;
  globalSetId: string;
}

export interface CardEntry {
  id: string;
  category?: string;
  name?: string;
  suggestedTemplate?: string;
}

export interface SaveResult {
  ok: boolean;
  status: number;
  error?: string;
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

  // ── Template-set API ──

  async function listSets(): Promise<TemplateSetSummary[]> {
    const resp = await fetch(SETS);
    if (!resp.ok) return [];
    return resp.json();
  }

  async function getPolicy(): Promise<TemplateSetPolicy | null> {
    const resp = await fetch(`${SETS}/policy`);
    if (!resp.ok) return null;
    return resp.json();
  }

  async function getSet(setId: string): Promise<TemplateSetSummary | null> {
    const resp = await fetch(`${SETS}/${encodeURIComponent(setId)}`);
    if (!resp.ok) return null;
    return resp.json();
  }

  async function loadSlotTemplate(setId: string, slotId: string): Promise<CardTemplate | null> {
    const resp = await fetch(
      `${SETS}/${encodeURIComponent(setId)}/templates/${encodeURIComponent(slotId)}`,
    );
    if (!resp.ok) return null;
    return resp.json();
  }

  async function saveSlotTemplate(
    setId: string,
    slotId: string,
    template: { name: string; description?: string; elements: unknown[] },
    opts: { confirmShadow?: boolean } = {},
  ): Promise<SaveResult> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (opts.confirmShadow) headers["X-Confirm-Shadow-Edit"] = "i-understand";
    const resp = await fetch(
      `${SETS}/${encodeURIComponent(setId)}/templates/${encodeURIComponent(slotId)}`,
      { method: "POST", headers, body: JSON.stringify(template), credentials: "include" },
    );
    if (resp.ok) return { ok: true, status: resp.status };
    let error: string | undefined;
    try { const body = await resp.json(); error = body?.error; } catch {}
    return { ok: false, status: resp.status, error };
  }

  async function deleteSlotTemplate(
    setId: string,
    slotId: string,
    opts: { confirmShadow?: boolean } = {},
  ): Promise<SaveResult> {
    const headers: Record<string, string> = {};
    if (opts.confirmShadow) headers["X-Confirm-Shadow-Edit"] = "i-understand";
    const resp = await fetch(
      `${SETS}/${encodeURIComponent(setId)}/templates/${encodeURIComponent(slotId)}`,
      { method: "DELETE", headers, credentials: "include" },
    );
    if (resp.ok) return { ok: true, status: resp.status };
    let error: string | undefined;
    try { const body = await resp.json(); error = body?.error; } catch {}
    return { ok: false, status: resp.status, error };
  }

  return {
    fetchCards,
    fetchCardData,
    renderSvg,
    rawImageUrl,
    listSets,
    getPolicy,
    getSet,
    loadSlotTemplate,
    saveSlotTemplate,
    deleteSlotTemplate,
  };
}
