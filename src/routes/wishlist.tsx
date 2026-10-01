import { createFileRoute } from '@tanstack/react-router';
import { WishlistPage } from '@/components/store/AccountPages';
export const Route=createFileRoute('/wishlist')({head:()=>({meta:[{title:'Wishlist — Solehaven'},{name:'description',content:'See the Solehaven footwear you have saved.'},{property:'og:title',content:'Wishlist — Solehaven'},{property:'og:description',content:'See the Solehaven footwear you have saved.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:()=><WishlistPage/>});
