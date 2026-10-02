# SoleHaven demo catalog seed

Deterministic, idempotent demo catalog for the SoleHaven Supabase project.

## Contents

| Table | Rows |
|---|---|
| `public.categories` | 8 (sneakers, running, basketball, casual, formal, sandals, training, trail) |
| `public.products` | 32 (4 per category, 4 fictional brands) |
| `public.product_variants` | 427 (US 6–12 across each product's colourways) |

Also encoded: 6 sale products (`compare_at > price`), 8 `is_new`, 10 `featured`,
2 low-stock variants (`stock <= low_threshold`), 33 sold-out sizes for realistic
inventory states. Prices span ₱2,495–₱7,495 so the shop price slider (₱2,000–₱10,000)
represents the range honestly. Every `image_key` is one of the eight assets the
app can resolve (`a1`–`a4`, `b1`–`b4`).

## Running it

The seed uses ordinary DML as the `postgres` role. It does not change schema,
RLS, grants, policies, or functions.

```sh
# .env must contain DATABASE_URL (Session-mode pooler, port 5432)
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f drizzle/seed/0001_seed_catalog.sql
```

Or from the Supabase dashboard: paste the file into the SQL editor and run it.

## Idempotency

- Every row has a fixed, deterministic UUID (SHA-1 of a stable namespace + key).
- `created_at` values are fixed, so homepage ordering is stable across runs.
- Upserts target the existing unique keys:
  - categories → `ON CONFLICT (slug) DO UPDATE`
  - products → `ON CONFLICT (slug) DO UPDATE`
  - variants → `ON CONFLICT (product_id, size, color) DO UPDATE`
- Re-running refreshes rows in place: no duplicate categories, products, SKUs, or
  variants. Verified by applying twice — counts identical, zero duplicates.

## Notes

- Demo content only: names, brands, copy, and prices are original SoleHaven
  placeholder data. No production or third-party records are reproduced.
- Data lives only in the catalog tables; `orders`, `order_items`, `reviews`,
  `wishlists`, and `user_roles` are untouched by this seed.