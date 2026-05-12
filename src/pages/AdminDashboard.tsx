import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Users, UserPlus, LogOut, Shield, Pencil, Building2,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../components/ui/dialog';
import type { UserRole } from '../types';

// ─── Types locaux ──────────────────────────────────────────────────────────────

type PharmacyOption = { id: string; name: string };

type ProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  pharmacy_id: string | null;
  created_at: string;
  pharmacy: { name: string } | null;
};

// ─── Fetch ─────────────────────────────────────────────────────────────────────

async function fetchAdminData(): Promise<{ profiles: ProfileRow[]; pharmacies: PharmacyOption[] }> {
  const [{ data: profiles }, { data: pharmacies }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, phone, role, pharmacy_id, created_at, pharmacy:pharmacies(name)')
      .order('created_at', { ascending: false }),
    supabase
      .from('pharmacies')
      .select('id, name')
      .eq('is_active', true)
      .order('name'),
  ]);

  return {
    profiles: (profiles ?? []) as unknown as ProfileRow[],
    pharmacies: (pharmacies ?? []) as unknown as PharmacyOption[],
  };
}

// ─── Constantes UI ─────────────────────────────────────────────────────────────

const ROLE_BADGE: Record<string, string> = {
  client: 'bg-blue-100 text-blue-700',
  pharmacist: 'bg-green-100 text-green-700',
  admin: 'bg-purple-100 text-purple-700',
};

const ROLE_LABEL: Record<string, string> = {
  client: 'Client',
  pharmacist: 'Pharmacien',
  admin: 'Admin',
};

// ─── Modal de modification ─────────────────────────────────────────────────────

function EditUserModal({
  profile,
  pharmacies,
  onClose,
}: {
  profile: ProfileRow;
  pharmacies: PharmacyOption[];
  onClose: () => void;
}) {
  const [role, setRole] = useState<UserRole>(profile.role);
  const [pharmacyId, setPharmacyId] = useState(profile.pharmacy_id ?? '');
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          role,
          pharmacy_id: role === 'pharmacist' ? pharmacyId || null : null,
        })
        .eq('id', profile.id);

      if (error) throw error;

      toast.success('Profil mis à jour avec succès !');
      queryClient.invalidateQueries({ queryKey: ['admin-data'] });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Modifier l'utilisateur</DialogTitle>
        </DialogHeader>

        <div className="space-y-1 py-1">
          <p className="text-sm font-medium text-gray-900">{profile.full_name ?? '—'}</p>
          {profile.phone && <p className="text-xs text-gray-400">{profile.phone}</p>}
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Rôle</Label>
            <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="client">Client</SelectItem>
                <SelectItem value="pharmacist">Pharmacien</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {role === 'pharmacist' && (
            <div className="space-y-1.5">
              <Label>Pharmacie liée</Label>
              <Select value={pharmacyId} onValueChange={setPharmacyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une pharmacie" />
                </SelectTrigger>
                <SelectContent>
                  {pharmacies.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-green-600 hover:bg-green-700"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              'Enregistrer'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Onglet Créer un pharmacien ────────────────────────────────────────────────

function CreatePharmacistTab({ pharmacies }: { pharmacies: PharmacyOption[] }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    pharmacy_id: '',
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Échec de la création du compte');

      const { error: profileError } = await supabase.from('profiles').insert({
        id: authData.user.id,
        full_name: form.full_name,
        role: 'pharmacist',
        pharmacy_id: form.pharmacy_id || null,
      });

      if (profileError) throw profileError;

      toast.success(`Compte pharmacien créé pour ${form.email} !`);
      setForm({ full_name: '', email: '', password: '', pharmacy_id: '' });
      queryClient.invalidateQueries({ queryKey: ['admin-data'] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleCreate} className="space-y-4 max-w-md">
      <div className="space-y-1.5">
        <Label htmlFor="full_name">Nom complet</Label>
        <Input
          id="full_name"
          name="full_name"
          placeholder="Dr. Moussa Diallo"
          value={form.full_name}
          onChange={handleChange}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="pharmacien@exemple.com"
          value={form.email}
          onChange={handleChange}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Mot de passe</Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          value={form.password}
          onChange={handleChange}
          required
          minLength={6}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Pharmacie</Label>
        <Select
          value={form.pharmacy_id}
          onValueChange={(v) => setForm((prev) => ({ ...prev, pharmacy_id: v }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Sélectionner une pharmacie" />
          </SelectTrigger>
          <SelectContent>
            {pharmacies.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="w-full bg-green-600 hover:bg-green-700"
      >
        {loading ? (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <UserPlus className="h-4 w-4 mr-2" />
            Créer le compte pharmacien
          </>
        )}
      </Button>
    </form>
  );
}

// ─── Composant principal ───────────────────────────────────────────────────────

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [editingProfile, setEditingProfile] = useState<ProfileRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-data'],
    queryFn: fetchAdminData,
  });

  const profiles = data?.profiles ?? [];
  const pharmacies = data?.pharmacies ?? [];

  const stats = {
    clients: profiles.filter((p) => p.role === 'client').length,
    pharmacists: profiles.filter((p) => p.role === 'pharmacist').length,
    total: profiles.length,
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <div>
              <span className="font-bold text-gray-900 text-sm">PHARMASEN</span>
              <span className="ml-2 px-1.5 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                Admin
              </span>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-1.5" />
            Déconnexion
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Titre */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestion des utilisateurs et des comptes pharmaciens
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Clients', value: stats.clients, color: 'bg-blue-500' },
            { label: 'Pharmaciens', value: stats.pharmacists, color: 'bg-green-600' },
            { label: 'Total', value: stats.total, color: 'bg-gray-500' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm"
            >
              <div className={`w-2 h-2 rounded-full ${stat.color} mb-3`} />
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-sm text-gray-500 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="users">
          <TabsList className="mb-6 w-full sm:w-auto">
            <TabsTrigger value="users" className="flex-1 sm:flex-none gap-1.5">
              <Users className="h-4 w-4" />
              Utilisateurs
            </TabsTrigger>
            <TabsTrigger value="create" className="flex-1 sm:flex-none gap-1.5">
              <UserPlus className="h-4 w-4" />
              Créer un pharmacien
            </TabsTrigger>
          </TabsList>

          {/* ── Onglet Utilisateurs ── */}
          <TabsContent value="users">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          Nom
                        </th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          Rôle
                        </th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          Pharmacie
                        </th>
                        <th className="px-5 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {profiles.map((profile) => (
                        <tr key={profile.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-5 py-4">
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {profile.full_name ?? '—'}
                              </p>
                              {profile.phone && (
                                <p className="text-xs text-gray-400 mt-0.5">{profile.phone}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[profile.role] ?? 'bg-gray-100 text-gray-700'}`}
                            >
                              {ROLE_LABEL[profile.role] ?? profile.role}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            {profile.pharmacy ? (
                              <span className="flex items-center gap-1.5 text-sm text-gray-600">
                                <Building2 className="h-3.5 w-3.5 text-gray-400" />
                                {profile.pharmacy.name}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button
                              onClick={() => setEditingProfile(profile)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                            >
                              <Pencil className="h-3 w-3" />
                              Modifier
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="md:hidden divide-y divide-gray-100">
                  {profiles.map((profile) => (
                    <div key={profile.id} className="px-4 py-4 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {profile.full_name ?? '—'}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[profile.role] ?? 'bg-gray-100 text-gray-700'}`}
                          >
                            {ROLE_LABEL[profile.role] ?? profile.role}
                          </span>
                          {profile.pharmacy && (
                            <span className="text-xs text-gray-400 truncate">
                              {profile.pharmacy.name}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => setEditingProfile(profile)}
                        className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                      >
                        <Pencil className="h-3 w-3" />
                        Modifier
                      </button>
                    </div>
                  ))}
                </div>

                {profiles.length === 0 && (
                  <p className="text-center text-sm text-gray-400 py-16">
                    Aucun utilisateur trouvé
                  </p>
                )}
              </div>
            )}
          </TabsContent>

          {/* ── Onglet Créer pharmacien ── */}
          <TabsContent value="create">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-1">
                Nouveau compte pharmacien
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                Le compte sera immédiatement actif avec le rôle pharmacien.
              </p>
              <CreatePharmacistTab pharmacies={pharmacies} />
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {editingProfile && (
        <EditUserModal
          profile={editingProfile}
          pharmacies={pharmacies}
          onClose={() => setEditingProfile(null)}
        />
      )}
    </div>
  );
}
