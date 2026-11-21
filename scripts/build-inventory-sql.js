#!/usr/bin/env node
// Writes supabase/unit_inventory.sql: the unit-inventory part of
// supabase/schema.sql as one file to paste into the Supabase SQL Editor.
// schema.sql stays the source of truth: change the tables there, then run
//   npm run inventory-sql          (rewrite the file)
//   npm run inventory-sql -- --check  (exit 1 if the file is out of date)
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const schemaPath = path.join(root, 'supabase', 'schema.sql');
const outPath = path.join(root, 'supabase', 'unit_inventory.sql');

const RULE = /^-- ─+$/;
const lines = fs.readFileSync(schemaPath, 'utf8').split('\n');

const title = lines.findIndex((l) => l.startsWith('-- UNIT INVENTORY (module: unit-inventory)'));
if (title < 1 || !RULE.test(lines[title - 1])) {
  console.error('Could not find the "UNIT INVENTORY (module: unit-inventory)" section in schema.sql');
  process.exit(1);
}
const start = title - 1;
// The section ends where the next ruled heading starts.
let end = lines.length;
for (let i = title + 2; i < lines.length; i++) {
  if (RULE.test(lines[i])) { end = i; break; }
}
const section = lines.slice(start, end).join('\n').trimEnd();
const rls = lines.filter((l) => /^alter table public\.unit_inventory_\w+ disable row level security;$/.test(l));

const out = [
  '-- Unit inventory tables for the Airbnb owners app.',
  '-- GENERATED from supabase/schema.sql by scripts/build-inventory-sql.js; do not edit by hand.',
  '-- Change schema.sql, then run: npm run inventory-sql',
  '-- Paste this whole file into the Supabase SQL Editor and click Run.',
  '-- Safe to run more than once: it only adds what is missing and changes no existing data.',
  '',
  section,
  '',
  '-- Row level security is off: the server uses the service role key.',
  ...rls,
  '',
].join('\n');

if (process.argv.includes('--check')) {
  const current = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8') : '';
  if (current !== out) {
    console.error('supabase/unit_inventory.sql is out of date. Run: npm run inventory-sql');
    process.exit(1);
  }
  console.log('supabase/unit_inventory.sql is up to date.');
} else {
  fs.writeFileSync(outPath, out);
  console.log(`Wrote supabase/unit_inventory.sql (${rls.length} tables).`);
}
