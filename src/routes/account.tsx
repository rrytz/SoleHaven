import { createFileRoute } from '@tanstack/react-router';
import { AccountPage } from '@/components/store/AccountPages';
export const Route=createFileRoute('/account')({head:()=>({meta:[{title:'My account — Solehaven'},{name:'description',content:'Manage your Solehaven orders and saved shoes.'},{property:'og:title',content:'My account — Solehaven'},{property:'og:description',content:'Manage your Solehaven orders and saved shoes.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:()=><AccountPage/>});
