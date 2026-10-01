import { createFileRoute } from '@tanstack/react-router';
import { AuthPage } from '@/components/store/AccountPages';
export const Route=createFileRoute('/register')({head:()=>({meta:[{title:'Create account — Solehaven'},{name:'description',content:'Create your Solehaven account to track orders.'},{property:'og:title',content:'Create account — Solehaven'},{property:'og:description',content:'Create your Solehaven account to track orders.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:()=><AuthPage mode='register'/>});
