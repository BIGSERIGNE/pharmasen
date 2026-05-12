import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import type { Profile } from '../../types';
import DesktopNav from './DesktopNav';
import BottomNav from './BottomNav';

interface LayoutProps {
  requiredRole?: 'client' | 'pharmacist';
}

export default function Layout({ requiredRole }: LayoutProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          navigate('/auth');
          return;
        }
        const user = session.user;

        let { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        // Profil absent : INSERT uniquement (jamais upsert pour ne pas écraser le rôle)
        if (!data) {
          const { data: created, error: createError } = await supabase
            .from('profiles')
            .insert({ id: user.id, full_name: user.email ?? '', role: 'client' })
            .select()
            .single();

          if (createError || !created) {
            await supabase.auth.signOut();
            navigate('/auth');
            return;
          }
          data = created;
        }

        setProfile(data);

        if (requiredRole && data.role !== requiredRole) {
          const dest =
            data.role === 'admin'      ? '/admin/dashboard' :
            data.role === 'pharmacist' ? '/pharma/dashboard' :
                                         '/home';
          navigate(dest);
          return;
        }

        setLoading(false);
      } catch {
        await supabase.auth.signOut();
        navigate('/auth');
      }
    };

    fetchProfile();
  }, [navigate, requiredRole]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DesktopNav profile={profile} />
      <main className="md:pt-16 pb-20 md:pb-0 min-h-screen">
        <Outlet context={{ profile, setProfile }} />
      </main>
      <BottomNav profile={profile} />
    </div>
  );
}
