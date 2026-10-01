# SoleStyle Supabase migration manifest (PREPARATION — nothing applied)

Source: Lovable-managed `xujrmpqliqffrawqsquz` (via gateway `c--c831a1b6-…-prod.lovable.cloud`).
Target: user-owned project (ref + credentials TBD — see §6).

## 1. Procedure

1. Freeze checkout (maintenance banner; `place_order` decrements live stock).
2. Target: fresh project → apply `drizzle/migrations/0000…sql` then `0001_guest_checkout.sql` via `drizzle-kit` with a Session-mode `DATABASE_URL` (port 5432, NOT Transaction pooler). Regenerate `src/integrations/supabase/types.ts`.
3. Source SQL editor: run `migration/export.sql`, download the 10 CSVs + counts; run the auth column query (§0) and decide auth path (service_role row copy preferred, §C of prep report).
4. `node migration/generate-inserts.cjs <csv-dir> import.sql` (tested with fixtures covering NULLs, quotes, unicode, jsonb, bools).
5. Target SQL editor: run `import.sql` (single transaction, fail-loud).
6. Run `migration/verify.sql` on BOTH projects; every result set must match (except §7 target-only checks).
7. Record below: export/import timestamps, counts, strategy.

## 2. Import order (FK-safe)

categories → products → product_variants → auth.users → user_roles → orders → order_items → reviews → wishlists.

## 3. Rollback (target only, pre-cutover)

```sql
TRUNCATE public.wishlists, public.reviews, public.order_items,
         public.orders, public.user_roles, public.product_variants,
         public.products, public.categories;
-- auth.users: delete ONLY imported IDs (list them explicitly), never truncate auth schema.
```

## 4. Verification gates (all must pass before cutover)

Counts ×9 identical · PK sets identical · zero orphans (§2) · `SUM(stock)` identical · zero money mismatches (§4) · guest `order_number` list identical · roles/reviews/wishlists owner coverage · 3 order spot checks · RLS probes (anon reads `[]`, `place_order` P0001-anon, `place_guest_order` resolves anon).

## 5. Fate of state

UUIDs preserved (explicit IDs); sessions invalidated (re-login); `localStorage` carts/wishlists survive automatically via preserved IDs; guest rows reconciled by `order_number`.

## 6. Owner actions required (BLOCKING — none supplied yet)

- [ ] New project ref + service_role key + Session-mode DATABASE_URL (never commit; `.env` only at implementation time)
- [ ] Source service_role access for export + auth column inspection
- [ ] Auth path decision + stock-freeze window + comms
- [ ] Confirm `bkzx…` stays quarantined; confirm cutover authority

## 7. Manifest record (fill at execution)

- source ref:
- target ref:
- export timestamp / counts:
- import timestamp / counts:
- auth strategy used:
- verifier + sign-off:
