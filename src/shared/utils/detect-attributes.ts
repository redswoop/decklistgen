import { ANCIENT_POKEMON, FUTURE_POKEMON } from "../constants/special-pokemon.js";
import type { TcgdexCard } from "../types/card.js";

export function isEx(name: string): boolean {
  return name.endsWith(" ex");
}

export function isV(name: string): boolean {
  return / V$/i.test(name) && !isVmax(name) && !isVstar(name);
}

export function isVmax(name: string): boolean {
  return / VMAX$/i.test(name);
}

export function isVstar(name: string): boolean {
  return / VSTAR$/i.test(name);
}

export function isAncient(card: TcgdexCard): boolean {
  const baseName = card.name.replace(/ ex$/i, "").trim();
  if (ANCIENT_POKEMON.some((p) => baseName === p)) return true;
  // Fallback: scan text for "Ancient" trait keyword
  const texts = getCardTexts(card);
  return texts.some((t) => /\bancient\b/i.test(t));
}

export function isFuture(card: TcgdexCard): boolean {
  const baseName = card.name.replace(/ ex$/i, "").trim();
  if (FUTURE_POKEMON.some((p) => baseName === p)) return true;
  const texts = getCardTexts(card);
  return texts.some((t) => /\bfuture\b/i.test(t));
}

export function isTera(card: TcgdexCard): boolean {
  if (/\btera\b/i.test(card.name)) return true;
  if (card.abilities?.some((a) => /\btera\b/i.test(a.name))) return true;
  return false;
}

function getCardTexts(card: TcgdexCard): string[] {
  const texts: string[] = [];
  card.abilities?.forEach((a) => { texts.push(a.effect); });
  card.attacks?.forEach((a) => { if (a.effect) texts.push(a.effect); });
  return texts;
}
