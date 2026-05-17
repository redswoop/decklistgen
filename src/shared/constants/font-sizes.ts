/** Default font size tokens — shared across JSON card templates.
 *  Every key here must be referenced by at least one template under
 *  data/templates/ (as `"fontSize": "$token"`). Dead tokens just clutter
 *  the gallery's Font Sizes UI without affecting any render. */
export const FONT_SIZES: Record<string, number> = {
  // Shared across templates (pokemon + trainer)
  footer:        14,
  ruleText:      26,
  label:         24,   // Weak/Resist/Retreat labels
  multiplier:    32,   // "×2", "-30"
  attackName:    38,
  damage:        46,
  attackEffect:  30,
  abilityName:   32,
  abilityEffect: 30,

  // Pokemon HP / name / evolves-from (used by all three pokemon templates)
  "cardName.fullart":    48,
  "hp.fullart":          52,
  "hpLabel.fullart":     25,
  "evolvesFrom.fullart": 37,

  // Used by pokemon-standard / pokemon-fullart / trainer (vstar uses bare variants above)
  "attackEffect.fullart":  30,
  "abilityName.fullart":   38,
  "abilityEffect.fullart": 30,
  "abilityPill.fullart":   30,

  // Trainer
  "cardName.trainer": 44,
  "subtitle.trainer": 28,
  trainerType:        32,
  trainerEffect:      36,

  // VSTAR-specific
  vstarPowerLabel:     26,
  "evolvesFrom.vstar": 28,

  // Fallback for unknown tokens (not exposed in UI)
  default:            24,
};
