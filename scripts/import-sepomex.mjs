/**
 * import-sepomex.mjs
 *
 * Parses the official SEPOMEX XML file (CPdescarga.xml) and imports
 * all postal codes into the Supabase `codigos_postales` table.
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_KEY=eyJ... \
 *   node scripts/import-sepomex.mjs CPdescarga.xml
 */

import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const [,, filePath = 'CPdescarga.xml'] = process.argv;

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Provide SUPABASE_URL and SUPABASE_SERVICE_KEY as env vars.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Parse XML with a simple streaming regex (no external deps) ────────────────
console.log(`Reading ${filePath}...`);
const xml = fs.readFileSync(filePath, 'utf8');

// Each record: <table xmlns="NewDataSet"><d_codigo>...</d_codigo>...<D_mnpio>...</D_mnpio>...<d_estado>...</d_estado>...</table>
const getVal = (record, tag) => {
  const m = record.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
  return m ? m[1].trim() : '';
};

const map = new Map(); // cp → { municipio, estado, colonias: Set }

const tableRe = /<table[^>]*>([\s\S]*?)<\/table>/g;
let match;
let total = 0;

while ((match = tableRe.exec(xml)) !== null) {
  const rec = match[1];
  const cp       = getVal(rec, 'd_codigo');
  const colonia  = getVal(rec, 'd_asenta');
  const municipio = getVal(rec, 'D_mnpio');
  const estado   = getVal(rec, 'd_estado');
  if (!cp || cp.length !== 5) continue;
  total++;

  if (!map.has(cp)) map.set(cp, { municipio, estado, colonias: new Set() });
  if (colonia) map.get(cp).colonias.add(colonia);
}

console.log(`Parsed ${total} rows → ${map.size} unique postal codes.`);

// ── Upsert in batches ──────────────────────────────────────────────────────────
const rows = [...map.entries()].map(([cp, { municipio, estado, colonias }]) => ({
  cp,
  municipio,
  estado,
  colonias: [...colonias].sort(),
}));

const BATCH = 500;
let inserted = 0;
let errors = 0;

for (let i = 0; i < rows.length; i += BATCH) {
  const batch = rows.slice(i, i + BATCH);
  const { error } = await supabase
    .from('codigos_postales')
    .upsert(batch, { onConflict: 'cp' });

  if (error) {
    console.error(`\nBatch error at row ${i}:`, error.message);
    errors++;
  } else {
    inserted += batch.length;
  }
  process.stdout.write(`\r${inserted}/${rows.length} inserted, ${errors} errors...`);
}

console.log(`\n✓ Done! ${inserted} postal codes in Supabase.`);
if (errors) console.warn(`⚠ ${errors} batches failed — re-run to retry.`);
