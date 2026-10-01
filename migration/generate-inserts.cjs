// SoleStyle migration INSERT generator — pure text transform, no credentials.
// Usage: node migration/generate-inserts.cjs <csv-dir> [out.sql]
// Reads <csv-dir>/*.csv (headers required, as downloaded from the SQL editor),
// emits explicit multi-row INSERTs preserving every primary key.
// Rules: no ON CONFLICT, no silent loss (empty file = error unless allowlisted),
// NULL for empty fields, fail loudly on type violations.
const fs = require('fs');
const path = require('path');

const TABLES = [
  { file: 'categories.csv', table: 'public.categories',
    cols: ['id:uuid', 'slug:text', 'name:text', 'image_key:text'] },
  { file: 'products.csv', table: 'public.products',
    cols: ['id:uuid', 'slug:text', 'name:text', 'brand:text', 'category_id:uuid?', 'gender:text', 'description:text', 'material:text', 'price:int', 'compare_at:int?', 'image_key:text', 'sku:text', 'featured:bool', 'is_new:bool', 'archived:bool', 'created_at:timestamptz'] },
  { file: 'product_variants.csv', table: 'public.product_variants',
    cols: ['id:uuid', 'product_id:uuid', 'size:int', 'color:text', 'stock:int', 'low_threshold:int'] },
  { file: 'user_roles.csv', table: 'public.user_roles',
    cols: ['id:uuid', 'user_id:uuid', 'role:text'] },
  { file: 'orders.csv', table: 'public.orders',
    cols: ['id:uuid', 'user_id:uuid?', 'order_number:text', 'status:text', 'payment_method:text', 'delivery_method:text', 'customer_name:text', 'email:text', 'phone:text', 'address:jsonb', 'subtotal:int', 'shipping:int', 'discount:int', 'total:int', 'created_at:timestamptz'] },
  { file: 'order_items.csv', table: 'public.order_items',
    cols: ['id:uuid', 'order_id:uuid', 'product_id:uuid?', 'variant_id:uuid?', 'name:text', 'size:int', 'color:text', 'quantity:int', 'unit_price:int'] },
  { file: 'reviews.csv', table: 'public.reviews',
    cols: ['id:uuid', 'product_id:uuid', 'user_id:uuid', 'rating:int', 'body:text', 'created_at:timestamptz'] },
  { file: 'wishlists.csv', table: 'public.wishlists',
    cols: ['user_id:uuid', 'product_id:uuid', 'created_at:timestamptz'] },
];
const EMPTY_OK = new Set([]);

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c === '\r') { /* skip */ }
    else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => !(r.length === 1 && r[0] === ''));
}

function lit(value, type) {
  const nullable = type.endsWith('?');
  const base = nullable ? type.slice(0, -1) : type;
  if (value === '' || value === '\\N') {
    if (!nullable) throw new Error(`empty value for non-nullable ${type}`);
    return 'NULL';
  }
  if (base === 'int') {
    if (!/^-?\d+$/.test(value)) throw new Error(`bad int: ${value}`);
    return value;
  }
  if (base === 'bool') {
    const v = value.toLowerCase();
    if (v === 'true' || v === 't') return 'TRUE';
    if (v === 'false' || v === 'f') return 'FALSE';
    throw new Error(`bad bool: ${value}`);
  }
  if (base === 'uuid') {
    if (!/^[0-9a-fA-F-]{36}$/.test(value)) throw new Error(`bad uuid: ${value}`);
  }
  if (base === 'timestamptz' && Number.isNaN(Date.parse(value))) throw new Error(`bad timestamptz: ${value}`);
  if (base === 'jsonb') JSON.parse(value);
  return `'${value.replace(/'/g, "''")}'`;
}

function main() {
  const dir = process.argv[2], outFile = process.argv[3];
  if (!dir) { console.error('usage: node generate-inserts.cjs <csv-dir> [out.sql]'); process.exit(1); }
  const out = ['-- SoleStyle import — generated. Run in TARGET SQL editor, tables in order.',
    '-- Fails loudly on conflict (no ON CONFLICT). Verify with migration/verify.sql after.',
    'BEGIN;'];
  for (const t of TABLES) {
    const raw = fs.readFileSync(path.join(dir, t.file), 'utf8');
    const rows = parseCsv(raw);
    if (!rows.length) throw new Error(`empty file (no header): ${t.file}`);
    const header = rows[0].map(h => h.trim());
    const want = t.cols.map(c => c.split(':')[0]);
    for (const c of want) if (!header.includes(c)) throw new Error(`${t.file}: missing column ${c}`);
    const data = rows.slice(1);
    if (!data.length && !EMPTY_OK.has(t.file)) throw new Error(`${t.file}: zero data rows — aborting (refuse silent loss)`);
    if (!data.length) { out.push(`-- ${t.table}: source empty, nothing to insert`); continue; }
    const idx = want.map(c => header.indexOf(c));
    const types = t.cols.map(c => c.split(':')[1]);
    const tuples = data.map((r, n) => {
      if (r.length < header.length) throw new Error(`${t.file} row ${n + 1}: short row`);
      return `(${idx.map((ci, k) => lit(r[ci], types[k])).join(', ')})`;
    });
    out.push(`INSERT INTO ${t.table} (${want.join(', ')}) VALUES`);
    out.push(tuples.join(',\n') + ';');
  }
  out.push('COMMIT;');
  const sql = out.join('\n') + '\n';
  if (outFile) fs.writeFileSync(outFile, sql, 'utf8');
  else process.stdout.write(sql);
  console.error(`tables: ${TABLES.length}, statements: ${TABLES.length + 2}`);
}

if (require.main === module) main();
module.exports = { parseCsv, lit };
