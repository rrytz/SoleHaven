-- Idempotent checkout.
--
-- A single customer action (a double-tap, a retry, or two racing tabs) must never
-- create two orders or deduct stock twice. The client now sends a per-submission
-- `idempotencyKey` inside the existing payload; no RPC signature changes, no new
-- parameters, and no new privileges are granted.
--
-- Uniqueness is scoped per principal -- (user_id, idempotency_key) with guests
-- grouped under the nil UUID -- so one customer's key can never resolve to another
-- customer's order. The index is partial, so every pre-existing order (NULL key) is
-- left untouched and the table is not rewritten.
--
-- Prices, stock, totals, user_id and status remain server-derived exactly as before:
-- the client-supplied key is used only to detect a repeat of the same submission.

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS idempotency_key uuid;

CREATE UNIQUE INDEX IF NOT EXISTS orders_idempotency_uq
  ON public.orders (COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid), idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Guest checkout: same validation, repricing and stock logic as before, plus
-- an early return when this submission key has already produced an order.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.place_guest_order(payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  line jsonb; v record; sub integer := 0; ship integer; total_amount integer;
  oid uuid; qty integer; addr jsonb; method text; delivery text;
  onum text; items jsonb := '[]'::jsonb; idem uuid; existing uuid; receipt jsonb;
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
  FOR line IN SELECT * FROM jsonb_array_elements(payload->'items') LOOP
  qty := (line->>'quantity')::integer; IF qty < 1 OR qty > 10 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
  SELECT pv.id, pv.stock, pv.product_id, pv.size, pv.color, p.name, p.price INTO v FROM public.product_variants pv JOIN public.products p ON p.id=pv.product_id WHERE pv.id=(line->>'variantId')::uuid AND NOT p.archived FOR UPDATE OF pv;
  IF NOT FOUND OR v.stock < qty THEN RAISE EXCEPTION 'An item is unavailable in the selected size'; END IF;
  sub := sub + v.price * qty;
  END LOOP;
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

  FOR line IN SELECT * FROM jsonb_array_elements(payload->'items') LOOP
  qty := (line->>'quantity')::integer;
  SELECT pv.id,pv.product_id,pv.size,pv.color,p.price,p.name INTO v FROM public.product_variants pv JOIN public.products p ON p.id=pv.product_id WHERE pv.id=(line->>'variantId')::uuid;
  UPDATE public.product_variants SET stock=stock-qty WHERE id=v.id;
  INSERT INTO public.order_items(order_id,product_id,variant_id,name,size,color,quantity,unit_price) VALUES (oid,v.product_id,v.id,v.name,v.size,v.color,qty,v.price);
  items := items || jsonb_build_object('name',v.name,'size',v.size,'color',v.color,'quantity',qty,'unit_price',v.price);
  END LOOP;
  RETURN jsonb_build_object('id',oid,'order_number',onum,'status','Order Placed','payment_method',method,'delivery_method',delivery,'subtotal',sub,'shipping',ship,'total',total_amount,'items',items);
END $$;

-- ---------------------------------------------------------------------------
-- Authenticated checkout: identical validation and repricing, keyed per user.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.place_order(payload jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid(); line jsonb; v record; sub integer := 0; ship integer;
  total_amount integer; oid uuid; qty integer; addr jsonb; method text;
  delivery text; idem uuid; existing uuid;
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
  FOR line IN SELECT * FROM jsonb_array_elements(payload->'items') LOOP
  qty := (line->>'quantity')::integer; IF qty < 1 OR qty > 10 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
  SELECT pv.id, pv.stock, pv.product_id, pv.size, pv.color, p.name, p.price INTO v FROM public.product_variants pv JOIN public.products p ON p.id=pv.product_id WHERE pv.id=(line->>'variantId')::uuid AND NOT p.archived FOR UPDATE OF pv;
  IF NOT FOUND OR v.stock < qty THEN RAISE EXCEPTION 'An item is unavailable in the selected size'; END IF;
  sub := sub + v.price * qty;
  END LOOP;
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

  FOR line IN SELECT * FROM jsonb_array_elements(payload->'items') LOOP
  qty := (line->>'quantity')::integer;
  SELECT pv.id,pv.product_id,pv.size,pv.color,p.price,p.name INTO v FROM public.product_variants pv JOIN public.products p ON p.id=pv.product_id WHERE pv.id=(line->>'variantId')::uuid;
  UPDATE public.product_variants SET stock=stock-qty WHERE id=v.id;
  INSERT INTO public.order_items(order_id,product_id,variant_id,name,size,color,quantity,unit_price) VALUES (oid,v.product_id,v.id,v.name,v.size,v.color,qty,v.price);
  END LOOP;
  RETURN oid;
END $$;

-- Grants are deliberately unchanged: guest RPC stays anon-only, account RPC stays
-- authenticated-only, and both remain SECURITY DEFINER as before.
REVOKE ALL ON FUNCTION public.place_guest_order(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_guest_order(jsonb) TO anon;
REVOKE ALL ON FUNCTION public.place_order(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_order(jsonb) TO authenticated;