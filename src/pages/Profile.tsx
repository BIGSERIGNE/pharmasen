import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { User, Phone, LogOut, Camera } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import type { Profile as ProfileType } from '../types';

export default function Profile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileType | null>(null);
  const [form, setForm] = useState({ full_name: '', phone: '' });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (data) {
        setProfile(data);
        setForm({ full_name: data.full_name ?? '', phone: data.phone ?? '' });
      }
      setLoading(false);
    };
    fetch();
  }, []);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);

    try {
      let avatarUrl = profile.avatar_url;

      if (avatarFile) {
        const ext = avatarFile.name.split('.').pop();
        const fileName = `avatars/${profile.id}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, avatarFile, { upsert: true });
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
          avatarUrl = urlData.publicUrl;
        }
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: form.full_name,
          phone: form.phone,
          avatar_url: avatarUrl,
        })
        .eq('id', profile.id);

      if (error) throw error;
      toast.success('Profil mis à jour avec succès');
      setProfile((p) => p ? { ...p, full_name: form.full_name, phone: form.phone, avatar_url: avatarUrl } : p);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const avatarSrc = avatarPreview ?? profile?.avatar_url;

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Mon profil</h1>

      {/* Avatar */}
      <div className="flex flex-col items-center mb-8">
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-primary-100 flex items-center justify-center overflow-hidden border-4 border-white shadow-lg">
            {avatarSrc ? (
              <img src={avatarSrc} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <User className="h-10 w-10 text-primary-600" />
            )}
          </div>
          <label
            htmlFor="avatar-upload"
            className="absolute bottom-0 right-0 w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center cursor-pointer shadow-md hover:bg-primary-700 transition-colors"
          >
            <Camera className="h-4 w-4 text-white" />
            <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </label>
        </div>
        <p className="mt-3 font-semibold text-gray-900">{profile?.full_name ?? 'Utilisateur'}</p>
        <span className={`mt-1 text-xs px-3 py-1 rounded-full font-medium ${
          profile?.role === 'pharmacist' ? 'bg-blue-100 text-blue-700' : 'bg-primary-100 text-primary-700'
        }`}>
          {profile?.role === 'pharmacist' ? 'Pharmacien' : 'Client'}
        </span>
      </div>

      {/* Form */}
      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <div className="space-y-1">
          <Label htmlFor="full_name" className="flex items-center gap-2">
            <User className="h-4 w-4 text-gray-400" />
            Nom complet
          </Label>
          <Input
            id="full_name"
            value={form.full_name}
            onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
            placeholder="Votre nom complet"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="phone" className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-gray-400" />
            Téléphone
          </Label>
          <Input
            id="phone"
            type="tel"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="+221 77 000 00 00"
          />
        </div>

        <Button type="submit" className="w-full" disabled={saving}>
          {saving ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : 'Enregistrer les modifications'}
        </Button>
      </form>

      {/* Logout */}
      <div className="mt-6">
        <Button
          variant="outline"
          className="w-full gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Se déconnecter
        </Button>
      </div>
    </div>
  );
}
