/** Matches safe card IDs: alphanumeric, dots, hyphens, underscores. */
export const VALID_CARD_ID = /^[a-zA-Z0-9._-]+$/;

export function isValidCardId(cardId: string): boolean {
  return VALID_CARD_ID.test(cardId) && !cardId.includes("..");
}
