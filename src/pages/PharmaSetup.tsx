import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Store, Upload, X } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';

const CITIES = ['Dakar', 'Thiès', 'Saint-Louis', 'Ziguinchor', 'Kaolack', 'Diourbel'];

async function uploadLogo(file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from('pharmacy-images')
    .upload(path, file, { upsert: true });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage
    .from('pharmacy-images')
    .getPublicUrl(path);
  return publicUrl;
}

export default function PharmaSetup() {
  const navigate = useNavigate();
  const [authLoading, setAuthLoading] = useState(true);
  const [userId, setUserId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: '',
    address: '',
    city: '',
    phone: '',
    email: '',
    opening_hours: '',
  });

  // Guard : vérifie session + role pharmacist + pas encore de pharmacy_id
  useEffect(() => {
    const check = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) { navigate('/auth'); return; }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role, pharmacy_id')
          .eq('id', session.user.id)
          .single();

        if (profile?.role !== 'pharmacist') { navigate('/home'); return; }
        if (profile?.pharmacy_id) { navigate('/pharma/dashboard'); return; }

        setUserId(session.user.id);
        setAuthLoading(false);
      } catch {
        navigate('/auth');
      }
    };
    check();
  }, [navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.city) { toast.error('Veuillez sélectionner une ville'); return; }
    setSubmitting(true);

    try {
      let image_url: string | null = null;

      if (imageFile) {
        image_url = await uploadLogo(imageFile);
      }

      // 1. Créer la pharmacie
      const { data: pharmacy, error: pharmaError } = await supabase
        .from('pharmacies')
        .insert({
          name: form.name,
          address: form.address,
          city: form.city,
          phone: form.phone,
          email: form.email || null,
          opening_hours: form.opening_hours || null,
          image_url,
          is_active: true,
        })
        .select()
        .single();

      if (pharmaError || !pharmacy) throw pharmaError ?? new Error('Erreur création pharmacie');

      // 2. Lier la pharmacie au profil du pharmacien
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ pharmacy_id: pharmacy.id })
        .eq('id', userId);

      if (profileError) throw profileError;

      toast.success('Pharmacie configurée avec succès !');
      navigate('/pharma/dashboard');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la configuration');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50">
      <div className="max-w-lg mx-auto px-4 py-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Store className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Bienvenue sur PHARMASEN !</h1>
          <p className="text-gray-500 mt-2 text-sm">
            Configurez votre pharmacie pour commencer à recevoir des commandes.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Logo */}
            <div className="space-y-1.5">
              <Label>Logo / Photo de la pharmacie</Label>
              <div className="flex items-center gap-4">
                {imagePreview ? (
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-gray-200 flex-shrink-0">
                    <img src={imagePreview} alt="Aperçu" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => { setImagePreview(null); setImageFile(null); }}
                      className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
                    >
                      <X className="h-3 w-3 text-white" />
                    </button>
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center flex-shrink-0">
                    <Store className="h-6 w-6 text-gray-400" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                >
                  <Upload className="h-4 w-4" />
                  {imagePreview ? 'Changer' : 'Choisir un fichier'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageChange}
                />
              </div>
            </div>

            {/* Nom */}
            <div className="space-y-1.5">
              <Label htmlFor="name">Nom de la pharmacie *</Label>
              <Input
                id="name"
                name="name"
                placeholder="Pharmacie de la Paix"
                value={form.name}
                onChange={handleChange}
                required
              />
            </div>

            {/* Adresse + Ville */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="address">Adresse *</Label>
                <Input
                  id="address"
                  name="address"
                  placeholder="123 Rue des Médecins"
                  value={form.address}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Ville *</Label>
                <Select value={form.city} onValueChange={(v) => setForm((p) => ({ ...p, city: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir une ville" />
                  </SelectTrigger>
                  <SelectContent>
                    {CITIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Téléphone + Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="phone">Téléphone *</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="+221 77 000 00 00"
                  value={form.phone}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email de la pharmacie</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="pharmacie@exemple.com"
                  value={form.email}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Horaires */}
            <div className="space-y-1.5">
              <Label htmlFor="opening_hours">Horaires d'ouverture</Label>
              <Input
                id="opening_hours"
                name="opening_hours"
                placeholder="Lun-Sam : 8h-20h  |  Dim : 9h-13h"
                value={form.opening_hours}
                onChange={handleChange}
              />
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-green-600 hover:bg-green-700 h-11 text-base"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Configurer ma pharmacie'
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
