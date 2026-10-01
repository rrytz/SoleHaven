import { createFileRoute } from '@tanstack/react-router';
import { OrdersPage } from '@/components/store/AccountPages';
export const Route=createFileRoute('/orders')({head:()=>({meta:[{title:'Order history — Solehaven'},{name:'description',content:'Track your Solehaven orders and deliveries.'},{property:'og:title',content:'Order history — Solehaven'},{property:'og:description',content:'Track your Solehaven orders and deliveries.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:()=><OrdersPage/>});
