import { Hono } from "hono";
import { SET_MAP, SET_NAMES, getEra } from "../../shared/constants/set-codes.js";
import { loadSet, loadEra, isSetLoaded, getSetName } from "../services/card-store.js";
import type { SetInfo } from "../../shared/types/card.js";
import { logAction, getClientIp } from "../services/logger.js";

const app = new Hono();

app.get("/", (c) => {
  const sets: SetInfo[] = [];
  const seen = new Set<string>();
  for (const [code, tcgdexId] of Object.entries(SET_MAP)) {
    if (seen.has(tcgdexId)) continue;
    seen.add(tcgdexId);
    sets.push({
      code,
      tcgdexId,
      name: SET_NAMES[code] ?? getSetName(code) ?? code,
      era: getEra(tcgdexId),
      loaded: isSetLoaded(code),
    });
  }
  return c.json(sets);
});

app.post("/load-era/:era", async (c) => {
  const era = c.req.param("era") as "sv" | "swsh";
  if (era !== "sv" && era !== "swsh") return c.json({ error: `Unknown era: ${era}` }, 400);
  logAction("set.loadEra", getClientIp(c), { era });
  const result = await loadEra(era);
  return c.json(result);
});

app.post("/:code/load", async (c) => {
  const code = c.req.param("code").toUpperCase();
  if (!SET_MAP[code]) return c.json({ error: `Unknown set: ${code}` }, 400);
  logAction("set.load", getClientIp(c), { setCode: code });
  const loaded = await loadSet(code);
  return c.json({ loaded, code, name: getSetName(code) });
});

export default app;
