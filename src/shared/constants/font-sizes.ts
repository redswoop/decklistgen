/** Default font size tokens — shared across JSON card templates. */
export const FONT_SIZES: Record<string, number> = {
  // Shared across all templates
  footer:        14,
  ruleText:      26,
  label:         24,   // Weak/Resist/Retreat labels
  multiplier:    32,   // "×2", "-30"
  attackName:    38,
  damage:        46,
  attackEffect:  30,
  abilityLabel:  32,
  abilityName:   32,
  abilityEffect: 30,

  // Standard pokemon
  cardName:      42,
  hp:            42,
  hpLabel:       22,
  evolvesFrom:   30,

  // Fullart (user-tweaked values from editor)
  "cardName.fullart": 48,
  "hp.fullart":       52,
  "hpLabel.fullart":  25,
  "evolvesFrom.fullart": 37,
  "attackEffect.fullart": 30,
  "abilityLabel.fullart": 38,
  "abilityName.fullart":  38,
  "abilityEffect.fullart": 30,

  // Trainer
  "cardName.trainer": 44,
  "subtitle.trainer": 28,
  trainerType:        32,
  trainerEffect:      36,

  // VSTAR-specific
  vstarPowerLabel:    26,
  "evolvesFrom.vstar": 28,

  // Basic energy
  energyFooter:       18,

  // Fallback for unknown tokens
  default:            24,
};
