// Costa Serena — main.ts (hand-in program, gta6-01)
// Menyalin game/ dan screenshots/ ke direktori output lalu menulis
// dossier.json LANGSUNG dari bytes buildDossier (tanpa JSON.stringify),
// supaya dossier byte-identical di setiap jalan grader.
// Tahap 2: penegasan — buildDossier membaca pohon game/ apa adanya, jadi
// hasil hanya bergantung pada isi repo, bukan pada waktu atau mesin.
import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-game.ts";

const root = dirname(fileURLToPath(import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR || "/output";

mkdirSync(out, { recursive: true });
// TIDAK PERNAH menghapus direktori output (bisa jadi mountpoint).
cpSync(join(root, "game"), join(out, "game"), { recursive: true });
cpSync(join(root, "screenshots"), join(out, "screenshots"), { recursive: true });

const caps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 48 * 1024 * 1024,
  game_path_max_bytes: 1000,
};

writeFileSync(join(out, "dossier.json"), buildDossier(out, caps));
console.log("Costa Serena handed in to " + out);
