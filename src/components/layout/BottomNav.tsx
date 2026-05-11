import { Link, useLocation } from 'react-router-dom';
import { Home, Store, ShoppingCart, ClipboardList, User, LayoutDashboard, Package } from 'lucide-react';
import { useCart } from '../CartContext';
import { cn } from '../../lib/utils';
import type { Profile } from '../../types';

interface BottomNavProps {
  profile: Profile | null;
}

export default function BottomNav({ profile }: BottomNavProps) {
  const location = useLocation();
  const { totalItems } = useCart();

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  if (profile?.role === 'pharmacist') {
    return (
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 flex">
        {[
          { to: '/pharma/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
          { to: '/pharma/stock', icon: Package, label: 'Stock' },
          { to: '/notifications', icon: Home, label: 'Notifs' },
          { to: '/profile', icon: User, label: 'Profil' },
        ].map(({ to, icon: Icon, label }) => (
          <Link key={to} to={to} className={cn('flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs transition-colors', isActive(to) ? 'text-primary-600' : 'text-gray-500')}>
            <Icon className="h-5 w-5" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 flex">
      <Link to="/home" className={cn('flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs transition-colors', isActive('/home') ? 'text-primary-600' : 'text-gray-500')}>
        <Store className="h-5 w-5" />
        <span>Pharmacies</span>
      </Link>
      <Link to="/cart" className={cn('flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs transition-colors relative', isActive('/cart') ? 'text-primary-600' : 'text-gray-500')}>
        <div className="relative">
          <ShoppingCart className="h-5 w-5" />
          {totalItems > 0 && (
            <span className="absolute -top-2 -right-2 bg-primary-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold leading-none">
              {totalItems}
            </span>
          )}
        </div>
        <span>Panier</span>
      </Link>
      <Link to="/orders" className={cn('flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs transition-colors', isActive('/orders') ? 'text-primary-600' : 'text-gray-500')}>
        <ClipboardList className="h-5 w-5" />
        <span>Commandes</span>
      </Link>
      <Link to="/profile" className={cn('flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs transition-colors', isActive('/profile') ? 'text-primary-600' : 'text-gray-500')}>
        <User className="h-5 w-5" />
        <span>Profil</span>
      </Link>
    </nav>
  );
}
