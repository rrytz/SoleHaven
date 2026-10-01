import { Link } from '@tanstack/react-router';
import { Heart, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStore } from '@/lib/store';
import { images, money, type Product } from '@/lib/catalog';
export function ProductCard({ product }: { product: Product }) {
  const { wishlist, toggleWish } = useStore();
  const onSale = product.compare_at && product.compare_at > product.price;
  const discount = onSale ? Math.round((1 - product.price / product.compare_at!) * 100) : 0;
  const saved = wishlist.includes(product.id);
  return (
    <article className="product-card">
      <div className="product-image-wrap">
        <Link to="/product/$slug" params={{ slug: product.slug }} aria-label={`View ${product.name}`}>
          <img src={images[product.image_key]} alt={`${product.brand} ${product.name}`} width={768} height={768} loading="lazy" />
        </Link>
        {onSale ? (
          <span className="sale-tag" aria-label={`${discount}% off`}>
            −{discount}%
          </span>
        ) : (
          product.is_new && <span className="sale-tag new-tag">New</span>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="wish-button"
          aria-label={`${saved ? 'Remove from' : 'Add to'} wishlist`}
          aria-pressed={saved}
          onClick={() => toggleWish(product.id)}
        >
          <Heart size={19} fill={saved ? 'currentColor' : 'none'} />
        </Button>
        <Link to="/product/$slug" params={{ slug: product.slug }} className="quick-view" tabIndex={-1} aria-hidden="true">
          View details <ArrowUpRight size={15} />
        </Link>
      </div>
      <Link to="/product/$slug" params={{ slug: product.slug }} className="product-info">
        <span className="product-brand">{product.brand}</span>
        <h3>{product.name}</h3>
        <div className="product-price">
          {money(product.price)} {onSale && <del>{money(product.compare_at!)}</del>}
        </div>
        <span className="product-meta">
          {product.gender} · {product.material}
        </span>
      </Link>
    </article>
  );
}
