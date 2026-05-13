import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ShoppingCart, Bell, User, LogOut, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useCart } from '../CartContext';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import type { Profile } from '../../types';

interface DesktopNavProps {
  profile: Profile | null;
}

export default function DesktopNav({ profile }: DesktopNavProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { totalItems } = useCart();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const active = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <header className="hidden md:flex fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 h-16 items-center px-6 gap-6">
      <Link
        to={profile?.role === 'pharmacist' ? '/pharma/dashboard' : '/home'}
        className="flex items-center gap-2 mr-4"
      >
        <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-sm">P</span>
        </div>
        <span className="text-xl font-bold text-primary-600">PHARMASEN</span>
      </Link>

      <nav className="flex items-center gap-1 flex-1">
        {profile?.role === 'client' && (
          <>
            <Link to="/home">
              <Button variant="ghost" size="sm" className={cn(active('/home') && 'bg-gray-100')}>
                Pharmacies
              </Button>
            </Link>
            <Link to="/orders">
              <Button variant="ghost" size="sm" className={cn(active('/orders') && 'bg-gray-100')}>
                Mes commandes
              </Button>
            </Link>
          </>
        )}
        {profile?.role === 'pharmacist' && (
          <>
            <Link to="/pharma/dashboard">
              <Button
                variant="ghost"
                size="sm"
                className={cn(active('/pharma/dashboard') && !active('/pharma/stock') && 'bg-gray-100 font-semibold')}
              >
                Dashboard
              </Button>
            </Link>
            <Link to="/pharma/stock">
              <Button
                variant="ghost"
                size="sm"
                className={cn(active('/pharma/stock') && 'bg-gray-100 font-semibold')}
              >
                Stock
              </Button>
            </Link>
            <Link to="/pharma/dashboard">
              <Button variant="ghost" size="sm">Commandes</Button>
            </Link>
            <Link to="/pharma/profile">
              <Button
                variant="ghost"
                size="sm"
                className={cn(active('/pharma/profile') && 'bg-gray-100 font-semibold')}
              >
                Profil
              </Button>
            </Link>
          </>
        )}
      </nav>

      <div className="flex items-center gap-2">
        {profile?.role === 'client' && (
          <Link to="/cart" className="relative">
            <Button variant="ghost" size="icon">
              <ShoppingCart className="h-5 w-5" />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {totalItems}
                </span>
              )}
            </Button>
          </Link>
        )}

        {profile?.role === 'pharmacist' ? (
          <>
            <Link to="/pharma/notifications">
              <Button variant="ghost" size="icon">
                <Bell className="h-5 w-5" />
              </Button>
            </Link>
            <Link to="/home">
              <Button variant="ghost" size="sm" className="gap-1.5 text-gray-500 text-xs">
                <ExternalLink className="h-3.5 w-3.5" />
                Site
              </Button>
            </Link>
            <span className="text-sm font-medium text-gray-800 max-w-[140px] truncate">
              {profile.full_name}
            </span>
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Déconnexion">
              <LogOut className="h-5 w-5" />
            </Button>
          </>
        ) : (
          <>
            <Link to="/notifications">
              <Button variant="ghost" size="icon">
                <Bell className="h-5 w-5" />
              </Button>
            </Link>
            <Link to="/profile">
              <Button variant="ghost" size="icon">
                <User className="h-5 w-5" />
              </Button>
            </Link>
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Déconnexion">
              <LogOut className="h-5 w-5" />
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
