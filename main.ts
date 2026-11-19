// Costa Serena — main.ts (hand-in program, pass 1)
// Copies game/ and screenshots/ into the output directory and writes
// dossier.json with buildDossier's bytes, exactly as the library returns
// them (no stringify, no trailing newline). Never clears the output dir:
// it may be a mountpoint, so files are only written into it.
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const out = process.env.MAKEFUN_OUTPUT_DIR || '/output';
const root = dirname(fileURLToPath(import.meta.url));

mkdirSync(out, { recursive: true });
cpSync(join(root, 'game'), join(out, 'game'), { recursive: true });
cpSync(join(root, 'screenshots'), join(out, 'screenshots'), { recursive: true });

const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(out, 'dossier.json'), dossier);
console.log(`Costa Serena: wrote ${join(out, 'dossier.json')} (${dossier.length} bytes)`);

// Sanity check the dossier we just wrote: it must parse as the dossier
// schema and carry the screenshots the gate counts. A failure here is a
// build bug, not a grading surprise.
const parsed = JSON.parse(new TextDecoder().decode(dossier));
if (parsed.schema !== 'makefun/dossier/v1') {
  throw new Error(`unexpected dossier schema: ${String(parsed.schema)}`);
}
const images = Array.isArray(parsed.images) ? parsed.images.length : 0;
console.log(`Costa Serena: dossier ok — schema ${parsed.schema}, ${images} screenshot(s)`);
