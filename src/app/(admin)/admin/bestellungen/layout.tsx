import { redirect } from 'next/navigation';
import { features } from '@/lib/config/features';

export default function BestellungenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!features.shopEnabled) {
    redirect('/admin');
  }

  return <>{children}</>;
}
