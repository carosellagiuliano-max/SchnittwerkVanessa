'use client';

import { useState } from 'react';
import { ShoppingBag, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/contexts/cart-context';
import { toast } from 'sonner';

// ============================================
// TYPES
// ============================================

interface Product {
  id: string;
  name: string;
  description?: string;
  priceCents: number;
  imageUrl?: string | null;
  sku?: string | null;
}

interface AddToCartButtonProps {
  product: Product;
  quantity?: number;
  disabled?: boolean;
  size?: 'default' | 'sm' | 'lg' | 'icon';
  variant?: 'default' | 'outline' | 'secondary';
  className?: string;
  showIcon?: boolean;
}

// ============================================
// COMPONENT
// ============================================

export function AddToCartButton({
  product,
  quantity = 1,
  disabled = false,
  size = 'default',
  variant = 'default',
  className = '',
  showIcon = true,
}: AddToCartButtonProps) {
  const { addItem } = useCart();
  const [isAdding, setIsAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  const handleAddToCart = async () => {
    if (disabled || isAdding) return;

    setIsAdding(true);

    try {
      addItem(
        {
          productId: product.id,
          type: 'product',
          quantity,
        },
        {
          name: product.name,
          description: product.description,
          priceCents: product.priceCents,
          imageUrl: product.imageUrl || undefined,
          sku: product.sku || undefined,
        }
      );

      setJustAdded(true);
      toast.success(`${product.name} wurde zum Warenkorb hinzugefügt`);

      // Reset "just added" state after animation
      setTimeout(() => setJustAdded(false), 2000);
    } catch (error) {
      console.error('Error adding to cart:', error);
      toast.error('Fehler beim Hinzufügen zum Warenkorb');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Button
      onClick={handleAddToCart}
      disabled={disabled || isAdding}
      size={size}
      variant={justAdded ? 'secondary' : variant}
      className={className}
    >
      {isAdding ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Wird hinzugefügt...
        </>
      ) : justAdded ? (
        <>
          <Check className="h-4 w-4 mr-2" />
          Hinzugefügt
        </>
      ) : (
        <>
          {showIcon && <ShoppingBag className="h-4 w-4 mr-2" />}
          In den Warenkorb
        </>
      )}
    </Button>
  );
}
