import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

type CartLine = { variantId: string; productId: string; quantity: number };
type StoreContextValue = { cart: CartLine[]; addItem: (variantId:string, productId:string, quantity?:number)=>void; removeItem:(variantId:string)=>void; updateQuantity:(variantId:string, quantity:number)=>void; clearCart:()=>void; wishlist:string[]; toggleWish:(id:string)=>void; user:User|null; authReady:boolean };
const StoreContext = createContext<StoreContextValue|null>(null);
export function StoreProvider({ children }: {children:ReactNode}) {
  const [cart,setCart]=useState<CartLine[]>([]);
  const [wishlist,setWishlist]=useState<string[]>([]);
  const [user,setUser]=useState<User|null>(null);
  const [authReady,setAuthReady]=useState(false);
  const [loaded,setLoaded]=useState(false);
  useEffect(()=>{
    try { setCart(JSON.parse(localStorage.getItem('sh-cart')||'[]')); setWishlist(JSON.parse(localStorage.getItem('sh-wishlist')||'[]')); } catch { /* reset invalid stored data */ }
    supabase.auth.getUser().then(({data})=>{setUser(data.user);setAuthReady(true)});
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{setUser(session?.user??null);setAuthReady(true)});
    setLoaded(true);
    return ()=>subscription.unsubscribe();
  },[]);
  useEffect(()=>{if(loaded)localStorage.setItem('sh-cart',JSON.stringify(cart))},[cart,loaded]);
  useEffect(()=>{if(loaded)localStorage.setItem('sh-wishlist',JSON.stringify(wishlist))},[wishlist,loaded]);
  const addItem=(variantId:string,productId:string,quantity=1)=>{setCart(prev=>{const found=prev.find(x=>x.variantId===variantId);return found?prev.map(x=>x.variantId===variantId?{...x,quantity:Math.min(10,x.quantity+quantity)}:x):[...prev,{variantId,productId,quantity}]});toast.success('Added to bag')};
  const removeItem=(variantId:string)=>{setCart(prev=>prev.filter(x=>x.variantId!==variantId));toast.success('Removed from bag')};
  const updateQuantity=(variantId:string,quantity:number)=>setCart(prev=>prev.map(x=>x.variantId===variantId?{...x,quantity:Math.max(1,Math.min(10,quantity))}:x));
  const toggleWish=(id:string)=>{setWishlist(prev=>{const exists=prev.includes(id);toast.success(exists?'Removed from wishlist':'Saved to wishlist');return exists?prev.filter(x=>x!==id):[...prev,id]});if(user){const query=supabase.from('wishlists');if(wishlist.includes(id)) query.delete().eq('user_id',user.id).eq('product_id',id).then(()=>{});else query.insert({user_id:user.id,product_id:id}).then(()=>{})}};
  return <StoreContext.Provider value={{cart,addItem,removeItem,updateQuantity,clearCart:()=>setCart([]),wishlist,toggleWish,user,authReady}}>{children}</StoreContext.Provider>;
}
export function useStore(){const value=useContext(StoreContext);if(!value) throw new Error('Store provider missing');return value}
