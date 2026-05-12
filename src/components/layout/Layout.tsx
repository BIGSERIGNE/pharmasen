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
        console.log('[Layout] fetchProfile démarré — requiredRole:', requiredRole);

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        console.log('[Layout] getSession → session:', session, '| error:', sessionError);

        if (!session?.user) {
          console.log('[Layout] ⛔ Pas de session → navigate(/auth)');
          navigate('/auth');
          return;
        }
        const user = session.user;
        console.log('[Layout] Utilisateur connecté :', user.id, user.email);

        let { data, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        console.log('[Layout] Profil DB → data:', data, '| error:', profileError);

        // Profil absent → tentative de création (Auth.tsx a pu rater si email non confirmé)
        if (!data) {
          console.log('[Layout] Profil introuvable → tentative upsert');
          const { data: created, error: createError } = await supabase
            .from('profiles')
            .upsert(
              { id: user.id, full_name: user.email ?? '', role: 'client' },
              { onConflict: 'id' }
            )
            .select()
            .single();

          console.log('[Layout] Upsert profil → data:', created, '| error:', createError);

          if (!created) {
            console.log('[Layout] ⛔ Impossible de créer le profil → signOut + navigate(/auth)');
            await supabase.auth.signOut();
            navigate('/auth');
            return;
          }
          data = created;
        }

        console.log('[Layout] ✅ Profil chargé :', data);
        setProfile(data);

        if (requiredRole && data.role !== requiredRole) {
          const dest =
            data.role === 'admin'       ? '/admin/dashboard' :
            data.role === 'pharmacist'  ? '/pharma/dashboard' :
                                          '/home';
          console.log(`[Layout] Rôle mismatch (attendu: ${requiredRole}, réel: ${data.role}) → navigate(${dest})`);
          navigate(dest);
          return;
        }

        console.log('[Layout] ✅ setLoading(false) — rendu de la page');
        setLoading(false);
      } catch (err) {
        console.error('[Layout] ❌ Exception inattendue:', err);
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
