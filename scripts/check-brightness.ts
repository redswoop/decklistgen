import { readdir } from "node:fs/promises";
import { join, basename } from "node:path";
import { analyzeImageBrightness } from "../src/server/services/pokeproxy/image-brightness";

const cacheDir = join(import.meta.dir, "..", "cache");

const files = (await readdir(cacheDir)).filter((f) =>
  f.endsWith("_composite.png")
);

if (files.length === 0) {
  console.log("No composite images found in cache/");
  process.exit(0);
}

console.log(`Found ${files.length} composite images\n`);
console.log("Card ID".padEnd(30) + "Brightness");
console.log("-".repeat(45));

const results: { id: string; brightness: number }[] = [];

for (const file of files) {
  const cardId = basename(file, "_composite.png");
  const buf = await Bun.file(join(cacheDir, file)).arrayBuffer();
  const brightness = await analyzeImageBrightness(Buffer.from(buf));
  results.push({ id: cardId, brightness });
}

// Sort by brightness ascending
results.sort((a, b) => a.brightness - b.brightness);

for (const { id, brightness } of results) {
  const label = brightness < 0.3 ? "DARK" : brightness > 0.7 ? "LIGHT" : "MID";
  console.log(`${id.padEnd(30)} ${brightness.toFixed(4)}  ${label}`);
}

// Summary stats
const brightnesses = results.map((r) => r.brightness);
const avg = brightnesses.reduce((a, b) => a + b, 0) / brightnesses.length;
const min = Math.min(...brightnesses);
const max = Math.max(...brightnesses);

console.log("\n--- Summary ---");
console.log(`Total:   ${results.length}`);
console.log(`Min:     ${min.toFixed(4)}`);
console.log(`Max:     ${max.toFixed(4)}`);
console.log(`Average: ${avg.toFixed(4)}`);
console.log(`Dark (<0.3):  ${results.filter((r) => r.brightness < 0.3).length}`);
console.log(`Mid (0.3-0.7): ${results.filter((r) => r.brightness >= 0.3 && r.brightness <= 0.7).length}`);
console.log(`Light (>0.7): ${results.filter((r) => r.brightness > 0.7).length}`);
