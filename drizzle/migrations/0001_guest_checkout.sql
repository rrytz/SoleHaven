-- Guest checkout migration.
-- Authenticated checkout (place_order, RLS, grants) is intentionally untouched.
-- Guests create orders through place_guest_order only. There is deliberately
-- NO anon SELECT/INSERT/UPDATE policy on orders or order_items, so anonymous
-- callers cannot read, modify, or enumerate any order. The guest receipt is
-- returned inline by the RPC; the client renders confirmation from that
-- payload without any further database read.

ALTER TABLE public.orders ALTER COLUMN user_id DROP NOT NULL;

CREATE FUNCTION public.place_guest_order(payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  line jsonb; v record; sub integer := 0; ship integer; total_amount integer;
  oid uuid; qty integer; addr jsonb; method text; delivery text;
  onum text; items jsonb := '[]'::jsonb;
BEGIN
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
  INSERT INTO public.orders(user_id,order_number,payment_method,delivery_method,customer_name,email,phone,address,subtotal,shipping,total) VALUES (NULL,onum,method,delivery,payload->>'name',payload->>'email',payload->>'phone',addr,sub,ship,total_amount) RETURNING id INTO oid;
  FOR line IN SELECT * FROM jsonb_array_elements(payload->'items') LOOP
  qty := (line->>'quantity')::integer;
  SELECT pv.id,pv.product_id,pv.size,pv.color,p.price,p.name INTO v FROM public.product_variants pv JOIN public.products p ON p.id=pv.product_id WHERE pv.id=(line->>'variantId')::uuid;
  UPDATE public.product_variants SET stock=stock-qty WHERE id=v.id;
  INSERT INTO public.order_items(order_id,product_id,variant_id,name,size,color,quantity,unit_price) VALUES (oid,v.product_id,v.id,v.name,v.size,v.color,qty,v.price);
  items := items || jsonb_build_object('name',v.name,'size',v.size,'color',v.color,'quantity',qty,'unit_price',v.price);
  END LOOP;
  RETURN jsonb_build_object('id',oid,'order_number',onum,'status','Order Placed','payment_method',method,'delivery_method',delivery,'subtotal',sub,'shipping',ship,'total',total_amount,'items',items);
END $$;

REVOKE ALL ON FUNCTION public.place_guest_order(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_guest_order(jsonb) TO anon;
