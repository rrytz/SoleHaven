import { createFileRoute } from '@tanstack/react-router';
import { CartPage } from '@/components/store/CartCheckout';
export const Route=createFileRoute('/cart')({head:()=>({meta:[{title:'Shopping bag — Solehaven'},{name:'description',content:'Review your Solehaven bag and checkout securely.'},{property:'og:title',content:'Shopping bag — Solehaven'},{property:'og:description',content:'Review your Solehaven bag and checkout securely.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:()=><CartPage/>});
