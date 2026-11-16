// makefun-frontend-01 submission builder (Node 22, standard library only).
//
// The frontend lives in app/ — plain static files (ES modules + CSS, no build step)
// that a browser opens at app/index.html and that read make.fun's public API at
// https://make.fun/api. Serving locally is a dev convenience: `node serve.ts` then
// open http://localhost:8080.
//
// This program hands the entry in: it copies app/ and screenshots/ from beside this
// file into the output directory (MAKEFUN_OUTPUT_DIR outside the grader, /output in
// it) and writes /output/dossier.json — the summary the judge reads (your screenshots,
// the first load's files and bytes, your source) — using the vendored make.fun library.
// vendor/makefun-frontend.ts is left untouched: the scorer requires dossier.json to be
// byte-for-byte what its own copy writes.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const here = fileURLToPath(new URL('.', import.meta.url));

// The scorer's own caps (reference/gate.json). Only text_max_bytes shapes the bytes;
// the rest refuse an entry the scorer would refuse (more than 3 screenshots or one
// over 256 KiB; more than 993 files and directories in app/ or 16 MiB of app files:
// app/ counts beside /output's own 1000-entry cap, its screenshots/ and dossier.json).
const LIMITS = {
  text_max_bytes: 163840,
  screenshots: { max: 3, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 16777216,
};

/** The directory to hand the entry into: /output in the grader, else the caller's choice. */
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(src, dest) {
  mkdirSync(dest, { recursive: true });
  if (existsSync(src)) cpSync(src, dest, { recursive: true });
}

// 1. Ship the frontend assets.
copyTree(join(here, 'app'), join(outDir, 'app'));

// 2. Ship the screenshots (shots.json declares which views they were taken of).
copyTree(join(here, 'screenshots'), join(outDir, 'screenshots'));

// 3. Write the dossier the judge reads, built byte-for-byte with the vendored library.
writeFileSync(join(outDir, 'dossier.json'), buildDossier(outDir, LIMITS));

console.log(`wrote dossier.json + app/ + screenshots/ to ${outDir}`);