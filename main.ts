// Costa Serena — main.ts (hand-in program, make.fun gta6-01)
// Menyalin game/ + screenshots/ dari repo ke direktori output dan menulis
// dossier.json dengan buildDossier dari vendor/makefun-game.ts — byte
// dossier ditulis APA ADANYA (Uint8Array), tanpa JSON.stringify ulang.
// JANGAN PERNAH menghapus direktori output (bisa jadi mountpoint).
import { buildDossier } from './vendor/makefun-game.ts';
import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

function copyTree(src: string, dst: string): void {
  mkdirSync(dst, { recursive: true });
  for (const name of readdirSync(src, { withFileTypes: true })) {
    const from = join(src, name.name);
    const to = join(dst, name.name);
    if (name.isDirectory()) copyTree(from, to);
    else if (name.isFile()) cpSync(from, to);
  }
}

function main(): void {
  const gameSrc = join(repoRoot, 'game');
  const shotsSrc = join(repoRoot, 'screenshots');
  if (!existsSync(gameSrc)) throw new Error(`game/ tidak ditemukan di ${repoRoot}`);
  if (!existsSync(shotsSrc)) throw new Error(`screenshots/ tidak ditemukan di ${repoRoot}`);
  mkdirSync(outDir, { recursive: true });
  copyTree(gameSrc, join(outDir, 'game'));
  copyTree(shotsSrc, join(outDir, 'screenshots'));
  const dossier = buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
  });
  writeFileSync(join(outDir, 'dossier.json'), dossier);
  // Validasi ringan: dossier harus parse sebagai JSON schema makefun/dossier/v1.
  const parsed = JSON.parse(new TextDecoder().decode(dossier)) as { schema?: string };
  if (parsed.schema !== 'makefun/dossier/v1') {
    throw new Error(`dossier schema tak dikenal: ${String(parsed.schema)}`);
  }
  console.log(`Costa Serena handed in to ${outDir} (dossier ${dossier.length} bytes)`);
}

main();
