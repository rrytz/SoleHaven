-- Aggregate inventory validation for checkout.
--
-- Both order functions validated stock one payload line at a time:
--
--     FOR line IN SELECT * FROM jsonb_array_elements(payload->'items') LOOP
--       qty := (line->>'quantity')::integer;
--       SELECT ... INTO v ... WHERE pv.id = (line->>'variantId')::uuid FOR UPDATE OF pv;
--       IF NOT FOUND OR v.stock < qty THEN RAISE ... END IF;
--       sub := sub + v.price * qty;
--     END LOOP;
--
-- `v.stock` is re-read on every iteration and is only mutated by a *later* loop, so a
-- payload that lists the same variantId twice is validated against the same pre-decrement
-- stock twice. Requesting 6 + 6 of a variant holding 10 passes both checks and then drives
-- stock negative in the decrement loop. The storefront cannot produce that shape today
-- because the cart merges by variantId, but the database is the only place this invariant
-- can actually be enforced, and it was not enforced.
--
-- This migration:
--   * keeps the existing per-line quantity bound (1..10) and the 1..30 item limit, but
--     applies them per line *before* any cast or lock, so a malformed payload can never
--     surface a cast error or an internal database message;
--   * aggregates the requested quantity per variantId and validates that aggregate against
--     the variant's current stock;
--   * locks every requested variant row once, in ascending variant id order, so two
--     concurrent orders touching the same variants in different payload orders take locks
--     in the same sequence and cannot deadlock;
--   * requires every requested variant to resolve, so deleted variants and archived
--     products are rejected instead of being silently dropped from the order;
--   * decrements each distinct variant exactly once, by its aggregate quantity;
--   * leaves pricing, shipping, authentication, guest rules, the order insert, the
--     idempotency early return and the unique-index arbiter untouched.
--
-- Both functions keep their signatures, return types, SECURITY DEFINER setting and
-- search_path, so existing grants are preserved by CREATE OR REPLACE. No new function, no
-- new table, no new privilege.
--
-- Atomicity is unchanged and still total: every RAISE happens before the order INSERT, and
-- a raised exception aborts the single PostgREST transaction, so a rejected order leaves
-- no order row and no stock movement.

-- ---------------------------------------------------------------------------
-- Guest checkout
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.place_guest_order(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  line jsonb; v record; sub integer := 0; ship integer; total_amount integer;
  oid uuid; qty integer; addr jsonb; method text; delivery text;
  onum text; items jsonb := '[]'::jsonb; idem uuid; existing uuid; receipt jsonb;
  requested integer := 0; resolved integer := 0; line_qty integer;
BEGIN
  IF jsonb_typeof(payload) <> 'object' THEN RAISE EXCEPTION 'Invalid payload'; END IF;

  -- Resolve the submission key, if the client sent a usable one.
  IF coalesce(payload->>'idempotencyKey','') <> '' THEN
    BEGIN
      idem := (payload->>'idempotencyKey')::uuid;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Invalid idempotencyKey';
    END;
    SELECT id INTO existing FROM public.orders
      WHERE idempotency_key = idem AND user_id IS NULL;
    IF existing IS NOT NULL THEN
      SELECT jsonb_build_object(
        'id', o.id, 'order_number', o.order_number, 'status', o.status,
        'payment_method', o.payment_method, 'delivery_method', o.delivery_method,
        'subtotal', o.subtotal, 'shipping', o.shipping, 'total', o.total,
        'items', coalesce((SELECT json_agg(json_build_object(
            'name', i.name, 'size', i.size, 'color', i.color,
            'quantity', i.quantity, 'unit_price', i.unit_price) ORDER BY i.id)::jsonb
          FROM public.order_items i WHERE i.order_id = o.id), '[]'::jsonb)
      ) INTO receipt FROM public.orders o WHERE o.id = existing;
      RETURN receipt;
    END IF;
  END IF;

  IF auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Use account checkout'; END IF;
  IF jsonb_typeof(payload->'items') != 'array' OR jsonb_array_length(payload->'items') < 1 OR jsonb_array_length(payload->'items') > 30 THEN RAISE EXCEPTION 'Invalid cart'; END IF;
  IF length(coalesce(payload->>'name','')) NOT BETWEEN 2 AND 100 OR length(coalesce(payload->>'email','')) NOT BETWEEN 5 AND 255 OR length(coalesce(payload->>'phone','')) NOT BETWEEN 7 AND 30 THEN RAISE EXCEPTION 'Invalid customer details'; END IF;
  addr := payload->'address'; IF jsonb_typeof(addr) != 'object' OR length(coalesce(addr->>'street','')) < 3 OR length(coalesce(addr->>'city','')) < 2 OR length(coalesce(addr->>'province','')) < 2 OR length(coalesce(addr->>'barangay','')) < 2 OR length(coalesce(addr->>'postal','')) < 4 THEN RAISE EXCEPTION 'Invalid address'; END IF;
  method := payload->>'payment'; delivery := payload->>'delivery'; IF method NOT IN ('Cash on Delivery','Bank Transfer') OR delivery NOT IN ('Standard','Express') THEN RAISE EXCEPTION 'Unsupported payment or delivery'; END IF;

  -- Pass 1: shape and per-line bounds only. Everything is validated as text before any
  -- cast, so a malformed quantity or variant id produces a clean message rather than an
  -- "invalid input syntax" error leaking out of the database.
  FOR line IN SELECT * FROM jsonb_array_elements(payload->'items') LOOP
    IF line->>'quantity' IS NULL OR (line->>'quantity') !~ '^[0-9]{1,4}$' THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
    line_qty := (line->>'quantity')::integer;
    IF line_qty < 1 OR line_qty > 10 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
    IF line->>'variantId' IS NULL OR (line->>'variantId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'Invalid cart'; END IF;
  END LOOP;

  -- Lock every requested variant exactly once, in ascending id order, before reading any
  -- stock. Ordering the lock acquisition independently of payload order removes the
  -- deadlock window that the previous per-line loop opened.
  PERFORM 1
     FROM public.product_variants pv
    WHERE pv.id = ANY (SELECT (l->>'variantId')::uuid FROM jsonb_array_elements(payload->'items') l)
    ORDER BY pv.id
    FOR UPDATE;

  -- Pass 2: one row per distinct variant, carrying the aggregate requested quantity.
  FOR v IN
    SELECT pv.id, pv.product_id, pv.size, pv.color, pv.stock, p.name, p.price, a.qty
    FROM (
      SELECT (l->>'variantId')::uuid AS vid, SUM((l->>'quantity')::integer)::integer AS qty
      FROM jsonb_array_elements(payload->'items') l
      GROUP BY (l->>'variantId')::uuid
    ) a
    JOIN public.product_variants pv ON pv.id = a.vid
    JOIN public.products p ON p.id = pv.product_id AND NOT p.archived
    ORDER BY pv.id
  LOOP
    IF v.stock < v.qty THEN
      RAISE EXCEPTION '% is no longer available in that size and quantity', v.name;
    END IF;
    sub := sub + v.price * v.qty;
    resolved := resolved + 1;
  END LOOP;

  -- Anything requested but not resolved is a deleted variant or an archived product.
  SELECT count(DISTINCT (l->>'variantId')::uuid)::integer INTO requested
    FROM jsonb_array_elements(payload->'items') l;

  IF resolved <> requested THEN RAISE EXCEPTION 'An item in your bag is no longer available'; END IF;

  ship := CASE WHEN delivery='Express' THEN 300 WHEN sub >= 3000 THEN 0 ELSE 150 END; total_amount := sub + ship;
  onum := 'SH-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));

  -- The unique index is the atomic arbiter: exactly one concurrent submission wins.
  BEGIN
    INSERT INTO public.orders(user_id,idempotency_key,order_number,payment_method,delivery_method,customer_name,email,phone,address,subtotal,shipping,total)
    VALUES (NULL,idem,onum,method,delivery,payload->>'name',payload->>'email',payload->>'phone',addr,sub,ship,total_amount) RETURNING id INTO oid;
  EXCEPTION WHEN unique_violation THEN
    IF idem IS NULL THEN RAISE; END IF;
    SELECT id INTO existing FROM public.orders WHERE idempotency_key = idem AND user_id IS NULL;
    IF existing IS NULL THEN RAISE; END IF;
    SELECT jsonb_build_object(
      'id', o.id, 'order_number', o.order_number, 'status', o.status,
      'payment_method', o.payment_method, 'delivery_method', o.delivery_method,
      'subtotal', o.subtotal, 'shipping', o.shipping, 'total', o.total,
      'items', coalesce((SELECT json_agg(json_build_object(
          'name', i.name, 'size', i.size, 'color', i.color,
          'quantity', i.quantity, 'unit_price', i.unit_price) ORDER BY i.id)::jsonb
        FROM public.order_items i WHERE i.order_id = o.id), '[]'::jsonb)
    ) INTO receipt FROM public.orders o WHERE o.id = existing;
    RETURN receipt;
  END;

  -- Decrement and record once per distinct variant, by the aggregate quantity.
  FOR v IN
    SELECT pv.id, pv.product_id, pv.size, pv.color, p.name, p.price, a.qty
    FROM (
      SELECT (l->>'variantId')::uuid AS vid, SUM((l->>'quantity')::integer)::integer AS qty
      FROM jsonb_array_elements(payload->'items') l
      GROUP BY (l->>'variantId')::uuid
    ) a
    JOIN public.product_variants pv ON pv.id = a.vid
    JOIN public.products p ON p.id = pv.product_id AND NOT p.archived
    ORDER BY pv.id
  LOOP
    UPDATE public.product_variants SET stock = stock - v.qty WHERE id = v.id;
    INSERT INTO public.order_items(order_id,product_id,variant_id,name,size,color,quantity,unit_price) VALUES (oid,v.product_id,v.id,v.name,v.size,v.color,v.qty,v.price);
    items := items || jsonb_build_object('name',v.name,'size',v.size,'color',v.color,'quantity',v.qty,'unit_price',v.price);
  END LOOP;
  RETURN jsonb_build_object('id',oid,'order_number',onum,'status','Order Placed','payment_method',method,'delivery_method',delivery,'subtotal',sub,'shipping',ship,'total',total_amount,'items',items);
END $function$;

-- ---------------------------------------------------------------------------
-- Authenticated checkout: identical inventory validation.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.place_order(payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid(); line jsonb; v record; sub integer := 0; ship integer;
  total_amount integer; oid uuid; qty integer; addr jsonb; method text;
  delivery text; idem uuid; existing uuid;
  requested integer := 0; resolved integer := 0; line_qty integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in to place your order'; END IF;
  IF jsonb_typeof(payload) <> 'object' THEN RAISE EXCEPTION 'Invalid payload'; END IF;

  IF coalesce(payload->>'idempotencyKey','') <> '' THEN
    BEGIN
      idem := (payload->>'idempotencyKey')::uuid;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Invalid idempotencyKey';
    END;
    SELECT id INTO existing FROM public.orders
      WHERE idempotency_key = idem AND user_id = uid;
    IF existing IS NOT NULL THEN RETURN existing; END IF;
  END IF;

  IF jsonb_typeof(payload->'items') != 'array' OR jsonb_array_length(payload->'items') < 1 OR jsonb_array_length(payload->'items') > 30 THEN RAISE EXCEPTION 'Invalid cart'; END IF;
  IF length(coalesce(payload->>'name','')) NOT BETWEEN 2 AND 100 OR length(coalesce(payload->>'email','')) NOT BETWEEN 5 AND 255 OR length(coalesce(payload->>'phone','')) NOT BETWEEN 7 AND 30 THEN RAISE EXCEPTION 'Invalid customer details'; END IF;
  addr := payload->'address'; IF jsonb_typeof(addr) != 'object' OR length(coalesce(addr->>'street','')) < 3 OR length(coalesce(addr->>'city','')) < 2 OR length(coalesce(addr->>'province','')) < 2 OR length(coalesce(addr->>'barangay','')) < 2 OR length(coalesce(addr->>'postal','')) < 4 THEN RAISE EXCEPTION 'Invalid address'; END IF;
  method := payload->>'payment'; delivery := payload->>'delivery'; IF method NOT IN ('Cash on Delivery','Bank Transfer') OR delivery NOT IN ('Standard','Express') THEN RAISE EXCEPTION 'Unsupported payment or delivery'; END IF;

  -- Pass 1: shape and per-line bounds only, validated as text before any cast.
  FOR line IN SELECT * FROM jsonb_array_elements(payload->'items') LOOP
    IF line->>'quantity' IS NULL OR (line->>'quantity') !~ '^[0-9]{1,4}$' THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
    line_qty := (line->>'quantity')::integer;
    IF line_qty < 1 OR line_qty > 10 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
    IF line->>'variantId' IS NULL OR (line->>'variantId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'Invalid cart'; END IF;
  END LOOP;

  -- Lock requested variants once, in ascending id order.
  PERFORM 1
     FROM public.product_variants pv
    WHERE pv.id = ANY (SELECT (l->>'variantId')::uuid FROM jsonb_array_elements(payload->'items') l)
    ORDER BY pv.id
    FOR UPDATE;

  -- Pass 2: aggregate per variant and validate against current stock.
  FOR v IN
    SELECT pv.id, pv.product_id, pv.size, pv.color, pv.stock, p.name, p.price, a.qty
    FROM (
      SELECT (l->>'variantId')::uuid AS vid, SUM((l->>'quantity')::integer)::integer AS qty
      FROM jsonb_array_elements(payload->'items') l
      GROUP BY (l->>'variantId')::uuid
    ) a
    JOIN public.product_variants pv ON pv.id = a.vid
    JOIN public.products p ON p.id = pv.product_id AND NOT p.archived
    ORDER BY pv.id
  LOOP
    IF v.stock < v.qty THEN
      RAISE EXCEPTION '% is no longer available in that size and quantity', v.name;
    END IF;
    sub := sub + v.price * v.qty;
    resolved := resolved + 1;
  END LOOP;

  SELECT count(DISTINCT (l->>'variantId')::uuid)::integer INTO requested
    FROM jsonb_array_elements(payload->'items') l;

  IF resolved <> requested THEN RAISE EXCEPTION 'An item in your bag is no longer available'; END IF;

  ship := CASE WHEN delivery='Express' THEN 300 WHEN sub >= 3000 THEN 0 ELSE 150 END; total_amount := sub + ship;

  BEGIN
    INSERT INTO public.orders(user_id,idempotency_key,order_number,payment_method,delivery_method,customer_name,email,phone,address,subtotal,shipping,total)
    VALUES (uid,idem,'SH-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),method,delivery,payload->>'name',payload->>'email',payload->>'phone',addr,sub,ship,total_amount) RETURNING id INTO oid;
  EXCEPTION WHEN unique_violation THEN
    IF idem IS NULL THEN RAISE; END IF;
    SELECT id INTO existing FROM public.orders WHERE idempotency_key = idem AND user_id = uid;
    IF existing IS NULL THEN RAISE; END IF;
    RETURN existing;
  END;

  -- Decrement and record once per distinct variant, by the aggregate quantity.
  FOR v IN
    SELECT pv.id, pv.product_id, pv.size, pv.color, p.name, p.price, a.qty
    FROM (
      SELECT (l->>'variantId')::uuid AS vid, SUM((l->>'quantity')::integer)::integer AS qty
      FROM jsonb_array_elements(payload->'items') l
      GROUP BY (l->>'variantId')::uuid
    ) a
    JOIN public.product_variants pv ON pv.id = a.vid
    JOIN public.products p ON p.id = pv.product_id AND NOT p.archived
    ORDER BY pv.id
  LOOP
    UPDATE public.product_variants SET stock = stock - v.qty WHERE id = v.id;
    INSERT INTO public.order_items(order_id,product_id,variant_id,name,size,color,quantity,unit_price) VALUES (oid,v.product_id,v.id,v.name,v.size,v.color,v.qty,v.price);
  END LOOP;
  RETURN oid;
END $function$;