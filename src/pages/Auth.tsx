import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { cn } from '../lib/utils';

type AuthMode = 'login' | 'register';

export default function Auth() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const switchToLogin = () => {
    setMode('login');
    setForm((prev) => ({ ...prev, password: '', full_name: '', phone: '' }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === 'login') {
        console.log('[Auth] Tentative de connexion pour :', form.email);
        const { data, error } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password,
        });
        console.log('[Auth] signInWithPassword → data:', data, '| error:', error);
        if (error) throw error;

        toast.success('Connexion réussie !');

        // Race : récupération du profil vs timeout 2s → on ne bloque jamais
        const profileFetch = supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single();

        const timeout = new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), 2000)
        );

        const result = await Promise.race([profileFetch, timeout]);
        console.log('[Auth] Résultat profiles query:', result);
        const role = (result as Awaited<typeof profileFetch> | null)?.data?.role;
        console.log('[Auth] Rôle détecté:', role ?? '(aucun — timeout ou profil absent)');

        // Si pas de profil en base, on en crée un maintenant (session active)
        if (!role) {
          console.log('[Auth] Profil absent → création avec role=client');
          const { data: upserted, error: upsertError } = await supabase
            .from('profiles')
            .upsert(
              { id: data.user.id, full_name: data.user.email ?? '', role: 'client' },
              { onConflict: 'id' }
            )
            .select();
          console.log('[Auth] Upsert profil → data:', upserted, '| error:', upsertError);
        }

        const destination =
          role === 'pharmacist' ? '/pharma/dashboard' :
          role === 'admin'      ? '/admin/dashboard' :
                                  '/home';
        console.log('[Auth] navigate vers :', destination);
        navigate(destination);
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
        });

        // signUp peut retourner une erreur même si le compte existe déjà (sécurité Supabase)
        // On considère le compte créé si data.user existe, quelle que soit l'erreur
        const userCreated = !!data?.user;

        if (!userCreated) {
          // Aucun utilisateur retourné → échec réel
          if (error) throw error;
          throw new Error('Erreur lors de la création du compte');
        }

        // Tentative d'insertion du profil (peut échouer si session absente = email non confirmé)
        if (data.session && data.user) {
          // Session immédiate (email confirmation désactivé) → on insère le profil
          await supabase.from('profiles').upsert({
            id: data.user.id,
            full_name: form.full_name,
            phone: form.phone,
            role: 'client',
          }, { onConflict: 'id' });
        }
        // Sinon le profil sera créé à la première connexion via Layout

        toast.success('Compte créé avec succès ! Connectez-vous maintenant.');
        switchToLogin();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Une erreur est survenue';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-green-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold">P</span>
            </div>
            <span className="text-2xl font-bold text-primary-600">PHARMASEN</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            {mode === 'login' ? 'Bienvenue !' : 'Créer un compte'}
          </h1>
          <p className="text-gray-500 mt-1">
            {mode === 'login' ? 'Connectez-vous à votre compte' : 'Rejoignez PHARMASEN gratuitement'}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
            <button
              onClick={() => setMode('login')}
              className={cn('flex-1 py-2 text-sm font-medium rounded-md transition-all', mode === 'login' ? 'bg-white shadow text-gray-900' : 'text-gray-500')}
            >
              Connexion
            </button>
            <button
              onClick={() => setMode('register')}
              className={cn('flex-1 py-2 text-sm font-medium rounded-md transition-all', mode === 'register' ? 'bg-white shadow text-gray-900' : 'text-gray-500')}
            >
              Inscription
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <div className="space-y-1">
                  <Label htmlFor="full_name">Nom complet</Label>
                  <Input
                    id="full_name"
                    name="full_name"
                    placeholder="Moussa Diallo"
                    value={form.full_name}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    placeholder="+221 77 000 00 00"
                    value={form.phone}
                    onChange={handleChange}
                  />
                </div>
              </>
            )}

            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="vous@exemple.com"
                value={form.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={handleChange}
                  required
                  minLength={6}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          <Link to="/" className="text-primary-600 hover:underline">← Retour à l'accueil</Link>
        </p>
      </div>
    </div>
  );
}
