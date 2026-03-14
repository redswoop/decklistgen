const BASE = "/gallery/editor";

export function useEditorApi() {
  async function fetchCards(): Promise<string[]> {
    const resp = await fetch(`${BASE}/cards`);
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

  return { fetchCards, fetchCardData, renderSvg, rawImageUrl };
}
