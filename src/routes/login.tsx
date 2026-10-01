import { createFileRoute } from '@tanstack/react-router';
import { AuthPage } from '@/components/store/AccountPages';
export const Route=createFileRoute('/login')({head:()=>({meta:[{title:'Sign in — Solehaven'},{name:'description',content:'Sign in to your Solehaven account.'},{property:'og:title',content:'Sign in — Solehaven'},{property:'og:description',content:'Sign in to your Solehaven account.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:()=><AuthPage mode='login'/>});
