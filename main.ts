// Costa Serena — make.fun gta6-01 hand-in program.
//
// Copies game/ and screenshots/ into the output directory and writes
// dossier.json via buildDossier from the kit's vendor/makefun-game.ts.
// The output directory is NEVER deleted or cleared (it can be a mountpoint):
// files are written into it. Run with node main.ts and MAKEFUN_OUTPUT_DIR
// set to the output directory.
//
// Usage: MAKEFUN_OUTPUT_DIR=/output node main.ts
import { cpSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR;
if (!out) {
  console.error('MAKEFUN_OUTPUT_DIR is not set');
  process.exit(2);
}

mkdirSync(out, { recursive: true });
for (const name of ['game', 'screenshots']) {
  const src = join(HERE, name);
  if (!existsSync(src)) {
    console.error(`missing ${name}/ next to main.ts`);
    process.exit(2);
  }
  cpSync(src, join(out, name), { recursive: true });
}

const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(out, 'dossier.json'), dossier);
console.log(`wrote ${join(out, 'dossier.json')} (${dossier.length} bytes)`);

// Summary for the build log: game/ size and screenshot sizes, so a bad
// hand-in (oversize shot, missing file) is visible without opening the dossier.
import { readdirSync, statSync } from 'node:fs';
function treeBytes(dir) {
  let files = 0, bytes = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { const t = treeBytes(p); files += t.files; bytes += t.bytes; }
    else { files += 1; bytes += statSync(p).size; }
  }
  return { files, bytes };
}
const gameStats = treeBytes(join(out, 'game'));
const shotStats = treeBytes(join(out, 'screenshots'));
console.log(`game/: ${gameStats.files} files, ${gameStats.bytes} bytes`);
console.log(`screenshots/: ${shotStats.files} files, ${shotStats.bytes} bytes`);
