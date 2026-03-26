/**
 * import-sepomex.mjs
 *
 * Parses the official SEPOMEX .txt file and inserts into Supabase.
 *
 * Usage:
 *   1. Download the file from:
 *      https://www.correosdemexico.gob.mx/SSLServicios/ConsultaCP/CodigoPostal_Exportar.aspx
 *      (click "Exportar todo" → downloads CPdescarga.txt, tab-separated, ISO-8859-1)
 *
 *   2. Convert encoding (required on Mac/Linux):
 *      iconv -f ISO-8859-1 -t UTF-8 CPdescarga.txt > sepomex.txt
 *
 *   3. Run:
 *      SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_KEY=eyJ... node scripts/import-sepomex.mjs sepomex.txt
 */

import fs from 'fs';
import readline from 'readline';
import { createClient } from '@supabase/supabase-js';

const [,, filePath] = process.argv;
if (!filePath) { console.error('Usage: node import-sepomex.mjs <sepomex.txt>'); process.exit(1); }

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY env vars');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Aggregate rows by CP → { cp, colonias[], municipio, estado }
const map = new Map();

const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });
let lineNum = 0;

for await (const line of rl) {
  lineNum++;
  if (lineNum <= 2) continue; // skip header rows
  const cols = line.split('\t');
  // SEPOMEX columns: d_codigo(0), d_asenta(1), d_tipo_asenta(2), D_mnpio(3), d_estado(4), d_ciudad(5), ...
  const cp        = (cols[0] || '').trim();
  const colonia   = (cols[1] || '').trim();
  const municipio = (cols[3] || '').trim();
  const estado    = (cols[4] || '').trim();
  if (!cp || cp.length !== 5) continue;

  if (!map.has(cp)) map.set(cp, { cp, municipio, estado, colonias: [] });
  const entry = map.get(cp);
  if (colonia && !entry.colonias.includes(colonia)) entry.colonias.push(colonia);
}

console.log(`Parsed ${map.size} unique postal codes from ${lineNum} lines.`);

// Insert in batches of 500
const rows = [...map.values()].map(({ cp, municipio, estado, colonias }) => ({
  cp,
  municipio,
  estado,
  colonias: colonias.sort(),
}));

const BATCH = 500;
let inserted = 0;

for (let i = 0; i < rows.length; i += BATCH) {
  const batch = rows.slice(i, i + BATCH);
  const { error } = await supabase.from('codigos_postales').upsert(batch, { onConflict: 'cp' });
  if (error) { console.error(`Batch ${i}-${i + BATCH} error:`, error.message); }
  else { inserted += batch.length; process.stdout.write(`\r${inserted}/${rows.length} inserted...`); }
}

console.log(`\nDone! ${inserted} postal codes imported.`);
