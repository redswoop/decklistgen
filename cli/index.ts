import { parseArgs } from "node:util";
import { writeFileSync } from "node:fs";
import { loadSet, getAllCards, getFilterOptions } from "../src/server/services/card-store.js";
import { applyFilters } from "../src/shared/utils/filter-cards.js";
import type { CardFilters, SpecialAttribute } from "../src/shared/types/filters.js";

// Handle subcommands before parseArgs
const subcommand = process.argv[2];

if (subcommand === "invite") {
  const { getDb } = await import("../src/server/services/db/database.js");
  const { createInviteCode } = await import("../src/server/services/invite-store.js");
  // Find first admin user
  const admin = getDb().query("SELECT id FROM users WHERE is_admin = 1 LIMIT 1").get() as { id: string } | null;
  if (!admin) {
    console.error("Error: No admin user found. Run the app and complete setup first.");
    process.exit(1);
  }
  const invite = createInviteCode(admin.id);
  console.log(`Invite code: ${invite.code}`);
  process.exit(0);
}

if (subcommand === "migrate") {
  const { getDb } = await import("../src/server/services/db/database.js");
  const { migrateAll } = await import("../src/server/services/db/migrate.js");
  const admin = getDb().query("SELECT id FROM users WHERE is_admin = 1 LIMIT 1").get() as { id: string } | null;
  if (!admin) {
    console.error("Error: No admin user found. Run the app and complete setup first.");
    process.exit(1);
  }
  const result = await migrateAll(admin.id);
  console.log(`Migration complete: ${result.decks} decks, ${result.cardSettings} card settings`);
  process.exit(0);
}

const { values, positionals } = parseArgs({
  options: {
    set: { type: "string", multiple: true, short: "s" },
    name: { type: "string", short: "n" },
    category: { type: "string", short: "c" },
    "trainer-type": { type: "string" },
    rarity: { type: "string", multiple: true, short: "r" },
    type: { type: "string", multiple: true, short: "t" },
    attr: { type: "string", multiple: true, short: "a" },
    fullart: { type: "boolean" },
    "no-fullart": { type: "boolean" },
    foil: { type: "boolean" },
    "no-foil": { type: "boolean" },
    era: { type: "string" },
    output: { type: "string", short: "o" },
    help: { type: "boolean", short: "h" },
    "list-filters": { type: "boolean" },
  },
  allowPositionals: true,
  strict: false,
});

if (values.help) {
  console.log(`Usage: bun run cli -- [options]

Options:
  -s, --set CODE       Set code(s) to load (e.g., SFA PAL)
  -n, --name TEXT      Name search (substring)
  -c, --category TYPE  Pokemon | Trainer | Energy
  --trainer-type TYPE  Item | Supporter | Stadium | Tool
  -r, --rarity TEXT    Rarity filter(s)
  -t, --type TYPE      Energy type(s) (Fire, Water, etc.)
  -a, --attr ATTR      Special attributes (ex, V, Ancient, Future, Tera)
  --fullart            Only full-art cards
  --no-fullart         Exclude full-art cards
  --foil               Only foil cards
  --no-foil            Exclude foil cards
  --era sv|swsh        Filter by era
  -o, --output FILE    Write decklist to file
  --list-filters       Show available filter values
  -h, --help           Show this help
`);
  process.exit(0);
}

const sets = values.set ?? [];
if (!sets.length) {
  console.error("Error: specify at least one set with --set CODE");
  process.exit(1);
}

// Load sets
for (const s of sets) {
  console.log(`Loading set ${s}...`);
  const count = await loadSet(s);
  console.log(`  ${count} cards loaded`);
}

if (values["list-filters"]) {
  const opts = getFilterOptions();
  console.log("\nAvailable rarities:", opts.rarities.join(", "));
  console.log("Available energy types:", opts.energyTypes.join(", "));
  console.log("Available trainer types:", opts.trainerTypes.join(", "));
  process.exit(0);
}

// Build filters
const filters: CardFilters = {};
if (sets.length) filters.sets = sets.map((s) => s.toUpperCase());
if (values.name) filters.nameSearch = values.name;
if (values.category) filters.category = values.category as CardFilters["category"];
if (values["trainer-type"]) filters.trainerType = values["trainer-type"];
if (values.rarity?.length) filters.rarities = values.rarity;
if (values.type?.length) filters.energyTypes = values.type;
if (values.attr?.length) filters.specialAttributes = values.attr as SpecialAttribute[];
if (values.era) filters.era = values.era as "sv" | "swsh";
if (values.fullart) filters.isFullArt = true;
if (values["no-fullart"]) filters.isFullArt = false;
if (values.foil) filters.hasFoil = true;
if (values["no-foil"]) filters.hasFoil = false;

const cards = applyFilters(getAllCards(), filters);
console.log(`\nFound ${cards.length} cards:\n`);

for (const card of cards) {
  const tags = [
    card.isEx && "ex",
    card.isV && "V",
    card.isVmax && "VMAX",
    card.isVstar && "VSTAR",
    card.isAncient && "Ancient",
    card.isFuture && "Future",
    card.isTera && "Tera",
    card.isFullArt && "FullArt",
  ].filter(Boolean);
  const tagStr = tags.length ? ` [${tags.join(",")}]` : "";
  console.log(`  ${card.setCode} ${card.localId} x1  # ${card.name} (${card.rarity})${tagStr}`);
}

if (values.output) {
  const lines = cards.map((c) => `${c.setCode} ${c.localId} x1  # ${c.name}`);
  writeFileSync(values.output, lines.join("\n") + "\n");
  console.log(`\nWrote ${cards.length} entries to ${values.output}`);
}
