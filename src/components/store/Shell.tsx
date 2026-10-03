import { Link, useNavigate, useLocation } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { Menu, Search, ShoppingBag, Heart, UserRound, X, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useStore } from '@/lib/store';

const links:[string,string][]=[['Home','/'],['Shop','/shop'],['Men','/shop?gender=Men'],['Women','/shop?gender=Women'],['Kids','/shop?gender=Kids'],['New arrivals','/shop?sort=Newest'],['Sale','/shop?sale=true']];
export function Shell({children}:{children:React.ReactNode}){
 const [menu,setMenu]=useState(false),[search,setSearch]=useState(false),[term,setTerm]=useState('');const menuBtnRef=useRef<HTMLButtonElement>(null);const searchBtnRef=useRef<HTMLButtonElement>(null);const searchInputRef=useRef<HTMLInputElement>(null);const {cart,user}=useStore();const navigate=useNavigate();const location=useLocation();
  const cur=location.search as Record<string,string|undefined>;const isTrue=(v:unknown)=>v===true||v==='true';const FILTER_KEYS=['category','gender','brand','size','sale','sort','maxPrice','available','q'];
  // TanStack's built-in `active` class is a fuzzy pathname match, so /shop?gender=Men would
  // mark "Shop" instead of "Men". Match the exact filter each link represents so exactly one
  // item is ever highlighted, and so aria-current points at the right destination.
  const activeFor=(label:string)=>{const p=location.pathname;
    if(label==='Home')return p==='/';
    if(label==='Shop')return p==='/shop'&&!FILTER_KEYS.some(k=>cur[k]!==undefined&&cur[k]!=='');
    if(p!=='/shop'&&p!=='/search')return false;
    if(label==='Men')return cur['gender']==='Men';
    if(label==='Women')return cur['gender']==='Women';
    if(label==='Kids')return cur['gender']==='Kids';
    if(label==='New arrivals')return cur['sort']==='Newest';
    if(label==='Sale')return isTrue(cur['sale']);
    return false;};
  const closeSearch=(restoreFocus=true)=>{setSearch(false);if(restoreFocus)searchBtnRef.current?.focus()};
 useEffect(()=>{if(!menu&&!search)return;const onKey=(e:KeyboardEvent)=>{if(e.key!=='Escape')return;if(menu){setMenu(false);return}closeSearch()};window.addEventListener('keydown',onKey);return ()=>window.removeEventListener('keydown',onKey)},[menu,search]);
  useEffect(()=>{if(!search)return;searchInputRef.current?.focus()},[search]);useEffect(()=>{if(!menu)return;const prev=document.body.style.overflow;document.body.style.overflow='hidden';return ()=>{document.body.style.overflow=prev;menuBtnRef.current?.focus()}},[menu]);
 const submit=(e:React.FormEvent)=>{e.preventDefault();const q=term.trim();closeSearch(false);navigate({to:'/search',search:q?{q}:{}})};
 return <><div className="announcement">Free shipping on orders over ₱3,000 <span className="mx-3">•</span> Made for every move</div><header className="site-header"><div className="site-header-inner"><div className="mobile-only"><Button variant="ghost" size="icon" aria-label="Open menu" ref={menuBtnRef} onClick={()=>setMenu(true)}><Menu/></Button></div><Link to="/" className="wordmark">SOLE<span>HAVEN</span><i>.</i></Link><nav className="desktop-nav" aria-label="Main navigation">{links.map(([label,url])=>{const on=activeFor(label);return <Link key={label} to={url} activeOptions={{exact:true}} activeProps={{className:''}} className={on?'nav-link is-current':'nav-link'} aria-current={on?'page':undefined}>{label}</Link>})}</nav><div className="header-actions"><Button variant="ghost" size="icon" ref={searchBtnRef} aria-label="Search" aria-expanded={search} aria-controls="site-search" onClick={()=>search?closeSearch():setSearch(true)}><Search/></Button><Link to="/wishlist" className="icon-link desktop-only" aria-label="Wishlist"><Heart size={20}/></Link><Link to={user?'/account':'/login'} className="icon-link desktop-only" aria-label="Account"><UserRound size={20}/></Link><Link to="/cart" className="icon-link bag-link" aria-label={`Bag with ${cart.reduce((n,x)=>n+x.quantity,0)} items`}><ShoppingBag size={21}/>{cart.length>0&&<span>{cart.reduce((n,x)=>n+x.quantity,0)}</span>}</Link></div></div>{search&&<form id="site-search" className="search-panel" role="search" onSubmit={submit}><Search size={20}/><Input ref={searchInputRef} autoFocus aria-label="Search products" placeholder="Search shoes, brands, styles..." value={term} onChange={e=>setTerm(e.target.value)}/><Button type="submit">Search</Button></form>}</header>
 {menu&&<div className="drawer-backdrop" onClick={()=>setMenu(false)}><aside className="mobile-drawer" onClick={e=>e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Mobile menu"><div className="flex items-center justify-between border-b border-border pb-5"><span className="wordmark">SOLE<span>HAVEN</span><i>.</i></span><Button variant="ghost" size="icon" aria-label="Close menu" onClick={()=>setMenu(false)}><X/></Button></div><nav className="py-5">{([...links,['Wishlist','/wishlist'],['Account',user?'/account':'/login'],['Contact','/contact']] as [string,string][]).map(([label,url])=><Link to={url} key={label} onClick={()=>setMenu(false)} className="drawer-link">{label}<ArrowRight size={17}/></Link>)}</nav></aside></div>}
 <main>{children}</main><footer className="site-footer"><div className="container-wide footer-grid"><div><Link to="/" className="wordmark">SOLE<span>HAVEN</span><i>.</i></Link><p className="mt-5 max-w-xs text-sm text-muted-foreground">Move with confidence. Footwear for wherever the day takes you.</p></div><div><h3>Explore</h3><Link to="/shop">Shop all</Link><Link to="/categories">Categories</Link><Link to="/about">Our story</Link></div><div><h3>Help</h3><Link to="/contact">Contact</Link><Link to="/faq">FAQs</Link><Link to="/shipping-returns">Shipping & returns</Link></div><div><h3>Your account</h3><Link to="/account">Account</Link><Link to="/orders">Orders</Link><Link to="/wishlist">Wishlist</Link></div></div><div className="container-wide footer-bottom"><span>© 2026 Solehaven. All rights reserved.</span><div><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link></div></div></footer></>;
}
