import { createFileRoute } from '@tanstack/react-router';
import { CheckoutPage } from '@/components/store/CartCheckout';
export const Route=createFileRoute('/checkout')({head:()=>({meta:[{title:'Checkout — Solehaven'},{name:'description',content:'Complete your Solehaven order securely.'},{property:'og:title',content:'Checkout — Solehaven'},{property:'og:description',content:'Complete your Solehaven order securely.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:()=><CheckoutPage/>});
