import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, AlertCircle, Search, X, Upload } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { formatPrice } from '../lib/utils';
import type { Medicine } from '../types';

async function fetchStockData() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non authentifié');

  const { data: profile } = await supabase.from('profiles').select('pharmacy_id').eq('id', user.id).single();
  if (!profile?.pharmacy_id) return { medicines: [], pharmacyId: null };

  const { data: medicines } = await supabase
    .from('medicines')
    .select('*')
    .eq('pharmacy_id', profile.pharmacy_id)
    .order('name');

  return { medicines: medicines ?? [], pharmacyId: profile.pharmacy_id };
}

interface MedicineForm {
  name: string;
  description: string;
  category: string;
  price: string;
  stock: string;
  requires_prescription: boolean;
  is_active: boolean;
}

const emptyForm: MedicineForm = {
  name: '',
  description: '',
  category: '',
  price: '',
  stock: '',
  requires_prescription: false,
  is_active: true,
};

export default function PharmaStock() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Medicine | null>(null);
  const [form, setForm] = useState<MedicineForm>(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['pharma-stock'],
    queryFn: fetchStockData,
  });

  const { medicines = [], pharmacyId } = data ?? {};

  const deleteMed = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('medicines').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharma-stock'] });
      toast.success('Médicament supprimé');
    },
    onError: () => toast.error('Erreur lors de la suppression'),
  });

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setImageFile(null);
    setDialogOpen(true);
  };

  const openEdit = (med: Medicine) => {
    setEditing(med);
    setForm({
      name: med.name,
      description: med.description ?? '',
      category: med.category ?? '',
      price: String(med.price),
      stock: String(med.stock),
      requires_prescription: med.requires_prescription,
      is_active: med.is_active,
    });
    setImageFile(null);
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pharmacyId) return;

    setSaving(true);
    try {
      let imageUrl = editing?.image_url ?? null;

      if (imageFile) {
        const ext = imageFile.name.split('.').pop();
        const fileName = `medicines/${pharmacyId}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('medicines')
          .upload(fileName, imageFile, { upsert: true });
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('medicines').getPublicUrl(fileName);
          imageUrl = urlData.publicUrl;
        }
      }

      const payload = {
        name: form.name,
        description: form.description || null,
        category: form.category || null,
        price: parseFloat(form.price),
        stock: parseInt(form.stock, 10),
        pharmacy_id: pharmacyId,
        image_url: imageUrl,
        requires_prescription: form.requires_prescription,
        is_active: form.is_active,
      };

      if (editing) {
        const { error } = await supabase.from('medicines').update(payload).eq('id', editing.id);
        if (error) throw error;
        toast.success('Médicament modifié');
      } else {
        const { error } = await supabase.from('medicines').insert(payload);
        if (error) throw error;
        toast.success('Médicament ajouté');
      }

      queryClient.invalidateQueries({ queryKey: ['pharma-stock'] });
      setDialogOpen(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const filtered = medicines.filter(
    (m: Medicine) =>
      search === '' ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      (m.category ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const lowStock = medicines.filter((m: Medicine) => m.stock < 10 && m.stock > 0);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion du stock</h1>
          <p className="text-gray-500 text-sm mt-1">{medicines.length} médicament{medicines.length > 1 ? 's' : ''}</p>
        </div>
        <Button onClick={openAdd} className="gap-2">
          <Plus className="h-4 w-4" />
          Ajouter
        </Button>
      </div>

      {/* Low stock alert */}
      {lowStock.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0" />
          <p className="text-amber-700 text-sm">
            <strong>{lowStock.length}</strong> médicament{lowStock.length > 1 ? 's' : ''} en stock faible :{' '}
            {lowStock.map((m: Medicine) => m.name).join(', ')}
          </p>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Rechercher..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X className="h-4 w-4 text-gray-400" />
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="bg-white rounded-xl p-4 animate-pulse h-16" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">💊</div>
          <p className="text-gray-500">Aucun médicament trouvé</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((med: Medicine) => (
            <div key={med.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3 shadow-sm">
              <div className="w-12 h-12 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {med.image_url ? (
                  <img src={med.image_url} alt={med.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl">💊</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900 text-sm">{med.name}</p>
                  {med.requires_prescription && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Ordo.</span>
                  )}
                  {!med.is_active && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Inactif</span>
                  )}
                </div>
                <p className="text-xs text-gray-500">{med.category ?? 'Non catégorisé'} · {formatPrice(med.price)}</p>
              </div>
              <div className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${
                med.stock === 0 ? 'bg-red-100 text-red-700' :
                med.stock < 10 ? 'bg-amber-100 text-amber-700' :
                'bg-green-100 text-green-700'
              }`}>
                {med.stock}
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(med)}>
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
                  onClick={() => {
                    if (window.confirm(`Supprimer "${med.name}" ?`)) deleteMed.mutate(med.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier le médicament' : 'Ajouter un médicament'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 mt-2">
            <div className="space-y-1">
              <Label htmlFor="name">Nom *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="category">Catégorie</Label>
              <Input
                id="category"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="Ex: Antibiotiques"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                rows={2}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="price">Prix (FCFA) *</Label>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  step="1"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="stock">Stock *</Label>
                <Input
                  id="stock"
                  type="number"
                  min="0"
                  value={form.stock}
                  onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                  required
                />
              </div>
            </div>

            {/* Image upload */}
            <div className="space-y-1">
              <Label>Image</Label>
              <div
                className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center cursor-pointer hover:border-primary-400 transition-colors"
                onClick={() => document.getElementById('med-image')?.click()}
              >
                <input
                  id="med-image"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                />
                <Upload className="h-6 w-6 text-gray-400 mx-auto mb-1" />
                <p className="text-sm text-gray-500">
                  {imageFile ? imageFile.name : (editing?.image_url ? 'Changer l\'image' : 'Uploader une image')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.requires_prescription}
                  onChange={(e) => setForm((f) => ({ ...f, requires_prescription: e.target.checked }))}
                  className="w-4 h-4 accent-primary-600"
                />
                <span className="text-sm text-gray-700">Ordonnance requise</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                  className="w-4 h-4 accent-primary-600"
                />
                <span className="text-sm text-gray-700">Actif</span>
              </label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Enregistrer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
