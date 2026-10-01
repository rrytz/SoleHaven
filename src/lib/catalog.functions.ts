import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { z } from 'zod';

export function publicClient() {
  const key = process.env['SUPABASE_PUBLISHABLE_KEY']!;
  return createClient<Database>(process.env['SUPABASE_URL']!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (key.startsWith('sb_') && headers.get('Authorization') === `Bearer ${key}`) headers.delete('Authorization');
      headers.set('apikey', key);
      return fetch(input, { ...init, headers });
    } },
  });
}
export const getCatalog = createServerFn({ method: 'GET' }).handler(async () => {
  const db = publicClient();
  const [{ data: products, error }, { data: categories }, { data: variants }] = await Promise.all([
    db.from('products').select('id,slug,name,brand,category_id,gender,description,material,price,compare_at,image_key,sku,featured,is_new,created_at').eq('archived', false).order('created_at', { ascending: false }),
    db.from('categories').select('id,slug,name,image_key'),
    db.from('product_variants').select('id,product_id,size,color,stock,low_threshold'),
  ]);
  if (error) throw new Error('Catalog unavailable');
  return { products: products ?? [], categories: categories ?? [], variants: variants ?? [] };
});
export const getProductReviews = createServerFn({ method: 'GET' })
  .inputValidator((input) => z.object({ productId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { data: reviews } = await publicClient().from('reviews').select('id,rating,body,created_at').eq('product_id', data.productId).order('created_at', { ascending: false });
    return reviews ?? [];
  });
