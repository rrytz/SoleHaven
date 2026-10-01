import a1 from '@/assets/products/a1.jpg';import a2 from '@/assets/products/a2.jpg';import a3 from '@/assets/products/a3.jpg';import a4 from '@/assets/products/a4.jpg';
import b1 from '@/assets/products/b1.jpg';import b2 from '@/assets/products/b2.jpg';import b3 from '@/assets/products/b3.jpg';import b4 from '@/assets/products/b4.jpg';
export const images:Record<string,string>={a1,a2,a3,a4,b1,b2,b3,b4};
export const money=(n:number)=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP',maximumFractionDigits:0}).format(n);
export type Catalog=Awaited<ReturnType<typeof import('./catalog.functions').getCatalog>>;
export type Product=Catalog['products'][number];
export type Variant=Catalog['variants'][number];
