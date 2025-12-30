import { redirect } from 'next/navigation';
import { features } from '@/lib/config/features';

// ============================================
// SHOP LAYOUT
// Redirects to home if shop is disabled
// ============================================

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Redirect to home if shop is disabled
  if (!features.shopEnabled) {
    redirect('/');
  }

  return <>{children}</>;
}
