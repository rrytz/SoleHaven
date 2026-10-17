import { createFileRoute,Link } from '@tanstack/react-router';import { useEffect, useState } from 'react';import { useQuery } from '@tanstack/react-query';import { Package } from 'lucide-react';import { Button } from '@/components/ui/button';
import { money } from '@/lib/catalog';
import { useStore } from '@/lib/store';
import { getMyOrders, type GuestOrderReceipt } from '@/lib/orders.functions';
export const Route=createFileRoute('/order-confirmation/$id')({head:()=>({meta:[{title:'Order status — Solehaven'},{name:'description',content:'Check the status of your Solehaven order.'},{property:'og:title',content:'Order status — Solehaven'},{property:'og:description',content:'Check the status of your Solehaven order.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:Page});
function Page(){
  const {id}=Route.useParams();
  const {user,authReady}=useStore();
  const [guest,setGuest]=useState<GuestOrderReceipt|null>(null);
  useEffect(()=>{try{const raw=localStorage.getItem('sh-last-guest-order');if(raw){const r=JSON.parse(raw) as GuestOrderReceipt;if(r&&r.id===id)setGuest(r)}}catch{/* ignore a corrupt stored receipt */}},[id]);
  // Account orders are read back from the database (RLS scopes this to the signed-in
  // owner), so the receipt shows the values that were actually persisted rather than
  // anything recomputed here. Same query key and gate as the account order pages.
  const query=useQuery({queryKey:['my-orders',user?.id],queryFn:()=>getMyOrders(),enabled:!!user});
  const mine=query.data?.find(o=>o.id===id);
  const receipt:GuestOrderReceipt|null=guest??(mine?{
    id:mine.id,order_number:mine.order_number,status:mine.status,
    payment_method:mine.payment_method,delivery_method:mine.delivery_method,
    subtotal:mine.subtotal,shipping:mine.shipping,total:mine.total,
    items:(mine.order_items||[]).map(i=>({name:i.name,size:i.size,color:i.color,quantity:i.quantity,unit_price:i.unit_price})),
  }:null);
  if(receipt)return <div className="container-wide page-space"><div className="page-heading"><p className="eyebrow">ORDER {receipt.order_number}</p><h1>Thank you for your order.</h1><p>Keep your order number for any questions about this order.</p></div><div className="order-record"><div className="order-record-top"><div><h2>{money(receipt.total)}</h2></div><span className="status-pill">{receipt.status}</span></div><div>{receipt.items.map((item,i)=><p key={i}>{item.name} · US {item.size} · {item.color} × {item.quantity}</p>)}<p className="mt-3 text-sm text-muted-foreground">{receipt.delivery_method} · {receipt.payment_method}</p><p className="mt-3 text-sm text-muted-foreground">Subtotal {money(receipt.subtotal)} · Shipping {receipt.shipping===0?'Free':money(receipt.shipping)}</p></div></div><Button asChild className="mt-8"><Link to="/shop">Continue shopping</Link></Button></div>;
  // Nothing is confirmed yet, so no success state may render. authReady gates the
  // signed-out case so "not found" is never flashed before the session resolves, and the
  // account query must settle before a signed-in visitor is told the order is not there.
  // A missing order and an order owned by someone else are reported identically.
  //
  // isFetching, not isLoading. Query-core defines isLoading as isPending && isFetching,
  // and a warm ['my-orders'] cache is already status 'success' from stale data, so
  // isLoading is false while the background refetch is still running. Gating on it let a
  // just-placed order render "not found" for a moment, because the placeholder list did
  // not contain it yet. isFetching stays true for the first fetch and for any refetch
  // over cached data, so no verdict is ever reached from a stale list.
  if(!authReady||(!!user&&query.isFetching))return <div className="container-wide page-space">Loading your order...</div>;
  if(query.isError)return <div className="container-wide empty-state"><Package size={52} className="text-muted-foreground"/><p className="eyebrow mt-6">ORDER STATUS UNAVAILABLE</p><h1>We couldn’t load this order.</h1><p>Please try again in a moment.</p><div className="empty-links"><Button onClick={()=>void query.refetch()}>Try again</Button><Link to="/shop">Continue shopping</Link></div></div>;
  return <div className="container-wide empty-state"><Package size={52} className="text-muted-foreground"/><p className="eyebrow mt-6">ORDER NOT FOUND</p><h1>We couldn’t find that order.</h1><p>This link may be incorrect, or the order may not belong to this account.</p><div className="empty-links">{user&&<Link to="/orders">View your orders</Link>}<Link to="/shop">Continue shopping</Link></div></div>
}
