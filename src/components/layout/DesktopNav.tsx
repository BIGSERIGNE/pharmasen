import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Bell, User, LogOut, LayoutDashboard, Package } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useCart } from '../CartContext';
import { Button } from '../ui/button';
import type { Profile } from '../../types';

interface DesktopNavProps {
  profile: Profile | null;
}

export default function DesktopNav({ profile }: DesktopNavProps) {
  const navigate = useNavigate();
  const { totalItems } = useCart();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <header className="hidden md:flex fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 h-16 items-center px-6 gap-6">
      <Link to={profile?.role === 'pharmacist' ? '/pharma/dashboard' : '/home'} className="flex items-center gap-2 mr-4">
        <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-sm">P</span>
        </div>
        <span className="text-xl font-bold text-primary-600">PHARMASEN</span>
      </Link>

      <nav className="flex items-center gap-1 flex-1">
        {profile?.role === 'client' && (
          <>
            <Link to="/home">
              <Button variant="ghost" size="sm">Pharmacies</Button>
            </Link>
            <Link to="/orders">
              <Button variant="ghost" size="sm">Mes commandes</Button>
            </Link>
          </>
        )}
        {profile?.role === 'pharmacist' && (
          <>
            <Link to="/pharma/dashboard">
              <Button variant="ghost" size="sm" className="gap-1">
                <LayoutDashboard className="h-4 w-4" />Dashboard
              </Button>
            </Link>
            <Link to="/pharma/stock">
              <Button variant="ghost" size="sm" className="gap-1">
                <Package className="h-4 w-4" />Stock
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
      </div>
    </header>
  );
}
