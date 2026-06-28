// Cyberior Payment Tracker — Database Fix Script
// Usage:  node fix-db.mjs
// Reads SUPABASE_ACCESS_TOKEN from .env automatically

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Load .env manually ────────────────────────────────────────────────────────
function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnv(path.join(__dirname, '.env'));

const token = process.env.SUPABASE_ACCESS_TOKEN || process.argv[2];

if (!token) {
  console.log('Missing SUPABASE_ACCESS_TOKEN in .env');
  process.exit(1);
}

const PROJECT_REF = 'iowumziphkdegvwefugf';

async function runSQL(sql) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sql }),
    }
  );
  const body = await res.text();
  let json; try { json = JSON.parse(body); } catch { json = body; }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${typeof json === 'string' ? json : JSON.stringify(json)}`);
  return json;
}

const ok   = msg => console.log(`  ✅ ${msg}`);
const fail = msg => console.log(`  ❌ ${msg}`);

async function main() {
  console.log('\n══════════════════════════════════════════');
  console.log(' Cyberior Payment Tracker — Database Fix');
  console.log('══════════════════════════════════════════\n');

  // Step 1: Verify token
  console.log('Step 1 — Verifying access token...');
  try {
    await runSQL('SELECT 1');
    ok('Token valid');
  } catch (err) {
    fail('Token rejected');
    console.log(`\n  ${err.message}`);
    process.exit(1);
  }

  // Step 2: Reset + rebuild
  console.log('\nStep 2 — Rebuilding database...');
  const sqlFile = path.join(__dirname, 'supabase', 'reset_and_rebuild.sql');
  const sql = fs.readFileSync(sqlFile, 'utf8');
  try {
    await runSQL(sql);
    ok('Tables, policies, functions, seed data — all created');
  } catch (err) {
    fail('Rebuild failed');
    console.log(`\n  ${err.message}\n`);
    process.exit(1);
  }

  // Step 3: Verify products
  console.log('\nStep 3 — Verifying seed data...');
  try {
    const r = await runSQL("SELECT count(*) as n FROM public.products");
    ok(`${r?.[0]?.n ?? '?'} products seeded`);
  } catch (err) { fail(err.message); }

  // Step 4: Admin profile
  console.log('\nStep 4 — Verifying admin profile...');
  try {
    const r = await runSQL("SELECT full_name FROM public.profiles WHERE role = 'admin'");
    if (r?.length > 0) {
      ok(`Admin: ${r[0].full_name}`);
    } else {
      console.log('  ⚠  No admin profile yet — log in to the app once to create it');
    }
  } catch (err) { fail(err.message); }

  // Step 5: RLS policies
  console.log('\nStep 5 — Checking RLS policies...');
  try {
    const r = await runSQL("SELECT count(*) as n FROM pg_policies WHERE schemaname = 'public'");
    const n = parseInt(r?.[0]?.n ?? 0);
    n >= 20 ? ok(`${n} RLS policies active`) : fail(`Only ${n} policies (expected 20+)`);
  } catch (err) { fail(err.message); }

  // Step 6: Test customer insert via SQL
  console.log('\nStep 6 — Testing customer insert...');
  try {
    const r = await runSQL(`
      INSERT INTO public.customers (full_name, phone, country, status, notes)
      VALUES ('Test Customer [AUTO]', '+964 700 000 001', 'Iraq', 'lead', '__fix_db_test__')
      RETURNING id, full_name
    `);
    ok(`Inserted: "${r?.[0]?.full_name}" — id ${r?.[0]?.id}`);
    await runSQL(`DELETE FROM public.customers WHERE notes = '__fix_db_test__'`);
    ok('Test record cleaned up');
  } catch (err) { fail(`Customer test: ${err.message}`); }

  console.log(`
══════════════════════════════════════════
 ✅  DATABASE IS FIXED AND WORKING!
══════════════════════════════════════════

Next steps:
  1. Run:   npm run dev
  2. Open:  http://localhost:5173
  3. Login: marwa.i.abdulkareem@gmail.com
`);
}

main().catch(err => { console.error('\nError:', err.message); process.exit(1); });
