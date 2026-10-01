import { createFileRoute } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { catalogQuery } from '@/lib/catalog-query';
import { ProductDetail } from '@/components/store/ProductDetail';
export const Route=createFileRoute('/product/$slug')({loader:({context})=>context.queryClient.ensureQueryData(catalogQuery),head:({params})=>({meta:[{title:`${params.slug.replaceAll('-',' ')} — Solehaven`},{name:'description',content:`Explore ${params.slug.replaceAll('-',' ')} footwear at Solehaven. Shop sizes and colors.`},{property:'og:title',content:`${params.slug.replaceAll('-',' ')} — Solehaven`},{property:'og:description',content:'Considered footwear for every move.'},{property:'og:type',content:'product'},{name:'twitter:card',content:'summary_large_image'}]}),component:Page});
function Page(){const {slug}=Route.useParams();useSuspenseQuery(catalogQuery);return <ProductDetail slug={slug}/>}
