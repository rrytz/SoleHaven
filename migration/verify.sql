-- SoleStyle migration VERIFY — run against SOURCE then TARGET, compare outputs.
-- All checks are read-only. Every query must return identical results on both
-- projects, except the final two (new-project-only properties).

-- 1. Row counts per table
SELECT 'categories', COUNT(*) FROM public.categories
UNION ALL SELECT 'products', COUNT(*) FROM public.products
UNION ALL SELECT 'product_variants', COUNT(*) FROM public.product_variants
UNION ALL SELECT 'user_roles', COUNT(*) FROM public.user_roles
UNION ALL SELECT 'orders', COUNT(*) FROM public.orders
UNION ALL SELECT 'order_items', COUNT(*) FROM public.order_items
UNION ALL SELECT 'reviews', COUNT(*) FROM public.reviews
UNION ALL SELECT 'wishlists', COUNT(*) FROM public.wishlists;

-- 2. FK orphans (each must return zero rows)
SELECT oi.id FROM public.order_items oi LEFT JOIN public.orders o ON o.id = oi.order_id WHERE o.id IS NULL;
SELECT oi.id FROM public.order_items oi LEFT JOIN public.products p ON p.id = oi.product_id WHERE oi.product_id IS NOT NULL AND p.id IS NULL;
SELECT oi.id FROM public.order_items oi LEFT JOIN public.product_variants v ON v.id = oi.variant_id WHERE oi.variant_id IS NOT NULL AND v.id IS NULL;
SELECT p.id FROM public.products p LEFT JOIN public.categories c ON c.id = p.category_id WHERE p.category_id IS NOT NULL AND c.id IS NULL;
SELECT r.id FROM public.reviews r LEFT JOIN public.products p ON p.id = r.product_id WHERE p.id IS NULL;
SELECT w.product_id FROM public.wishlists w LEFT JOIN public.products p ON p.id = w.product_id WHERE p.id IS NULL;

-- 3. Inventory preserved exactly
SELECT COALESCE(SUM(stock), 0) AS total_stock FROM public.product_variants;

-- 4. Order money consistency (must return zero rows)
SELECT id, subtotal, shipping, total FROM public.orders WHERE subtotal + shipping <> total;
SELECT oi.order_id, oi.quantity, oi.unit_price FROM public.order_items oi;

-- 5. Guest orders preserved (NULL user_id rows; record order_numbers)
SELECT id, order_number, total FROM public.orders WHERE user_id IS NULL ORDER BY created_at;

-- 6. Ownership coverage (every row must join a migrated user or be a guest order)
SELECT r.id FROM public.reviews r WHERE r.user_id IS NULL;
SELECT w.product_id FROM public.wishlists w WHERE w.user_id IS NULL;
SELECT ur.id, ur.user_id, ur.role FROM public.user_roles ur ORDER BY ur.user_id;

-- 7. Reviews distribution sanity (avg per product; informational)
SELECT product_id, COUNT(*), ROUND(AVG(rating)::numeric, 2) FROM public.reviews GROUP BY product_id;

-- TARGET ONLY (after import): functions + grants present
-- SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public' AND p.proname IN ('place_order', 'place_guest_order', 'is_admin');
-- SELECT grantee, privilege_type FROM information_schema.routine_privileges
-- WHERE routine_schema = 'public' AND routine_name IN ('place_order', 'place_guest_order');
