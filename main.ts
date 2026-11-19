// Costa Serena — main.ts (hand-in entry point, pass 2 of 2 — final)
// Copies game/ + screenshots/ into the output dir (NEVER deletes/clears it —
// it may be a mountpoint) and writes dossier.json via buildDossier from
// vendor/makefun-game.ts. Runs as-is under `node main.ts`.
import { buildDossier } from './vendor/makefun-game.ts';
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const out = process.env.MAKEFUN_OUTPUT_DIR;
if (!out) throw new Error('MAKEFUN_OUTPUT_DIR is not set');

const root = path.dirname(fileURLToPath(import.meta.url));
mkdirSync(out, { recursive: true });
// Copy into the output dir WITHOUT clearing it first.
cpSync(path.join(root, 'game'), path.join(out, 'game'), { recursive: true });
cpSync(path.join(root, 'screenshots'), path.join(out, 'screenshots'), { recursive: true });

const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(path.join(out, 'dossier.json'), dossier);
console.log('dossier written:', path.join(out, 'dossier.json'), dossier.length, 'bytes');
