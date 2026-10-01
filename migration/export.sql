-- SoleStyle migration EXPORT — run in the SOURCE project SQL editor (xujrmp…).
-- Read-only. Downloads as CSV (include headers). One result set per query, in order.
-- Do NOT run against the target. Do NOT modify anything.

-- 0. Auth column inventory (decides importability; GoTrue-version dependent)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'auth' AND table_name = 'users'
ORDER BY ordinal_position;

-- 1. Row counts (record in MANIFEST.md)
SELECT 'categories' AS t, COUNT(*) FROM public.categories
UNION ALL SELECT 'products', COUNT(*) FROM public.products
UNION ALL SELECT 'product_variants', COUNT(*) FROM public.product_variants
UNION ALL SELECT 'user_roles', COUNT(*) FROM public.user_roles
UNION ALL SELECT 'orders', COUNT(*) FROM public.orders
UNION ALL SELECT 'order_items', COUNT(*) FROM public.order_items
UNION ALL SELECT 'reviews', COUNT(*) FROM public.reviews
UNION ALL SELECT 'wishlists', COUNT(*) FROM public.wishlists
UNION ALL SELECT 'auth_users', COUNT(*) FROM auth.users;

-- 2. categories
SELECT id, slug, name, image_key FROM public.categories ORDER BY id;

-- 3. products
SELECT id, slug, name, brand, category_id, gender, description, material,
       price, compare_at, image_key, sku, featured, is_new, archived, created_at
FROM public.products ORDER BY id;

-- 4. product_variants (capture exact stock)
SELECT id, product_id, size, color, stock, low_threshold
FROM public.product_variants ORDER BY id;

-- 5. user_roles
SELECT id, user_id, role FROM public.user_roles ORDER BY id;

-- 6. orders (guest rows have NULL user_id — must stay NULL)
SELECT id, user_id, order_number, status, payment_method, delivery_method,
       customer_name, email, phone, address, subtotal, shipping, discount,
       total, created_at
FROM public.orders ORDER BY created_at, id;

-- 7. order_items
SELECT id, order_id, product_id, variant_id, name, size, color, quantity, unit_price
FROM public.order_items ORDER BY id;

-- 8. reviews
SELECT id, product_id, user_id, rating, body, created_at
FROM public.reviews ORDER BY id;

-- 9. wishlists
SELECT user_id, product_id, created_at FROM public.wishlists ORDER BY user_id, product_id;

-- 10. auth.users (full row needed for ID/password-hash preservation;
--     exact columns depend on query 0 — adjust the column list to match)
SELECT id, email, encrypted_password, email_confirmed_at, created_at
FROM auth.users ORDER BY id;
