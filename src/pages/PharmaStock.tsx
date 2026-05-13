import React, { useRef, useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Search, ImagePlus, Package } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../components/ui/dialog';
import { formatPrice } from '../lib/utils';
import type { Medicine } from '../types';

// ─── Data fetch ───────────────────────────────────────────────────────────────

async function fetchStockData() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Non authentifié');

  const { data: profile } = await supabase
    .from('profiles')
    .select('pharmacy_id')
    .eq('id', session.user.id)
    .single();

  if (!profile?.pharmacy_id) return { medicines: [] as Medicine[], pharmacyId: null as string | null };

  const { data: medicines } = await supabase
    .from('medicines')
    .select('*')
    .eq('pharmacy_id', profile.pharmacy_id)
    .order('name');

  return { medicines: (medicines ?? []) as Medicine[], pharmacyId: profile.pharmacy_id as string };
}

// ─── Upload helper ────────────────────────────────────────────────────────────

async function uploadMedicineImage(file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('medicine-images').upload(path, file, { upsert: true });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from('medicine-images').getPublicUrl(path);
  return publicUrl;
}

// ─── Medicine modal ───────────────────────────────────────────────────────────

type MedForm = {
  name: string;
  description: string;
  category: string;
  price: string;
  stock: string;
  requires_prescription: boolean;
};

const EMPTY_FORM: MedForm = {
  name: '', description: '', category: '', price: '', stock: '0', requires_prescription: false,
};

function toForm(med: Medicine): MedForm {
  return {
    name: med.name,
    description: med.description ?? '',
    category: med.category ?? '',
    price: String(med.price),
    stock: String(med.stock),
    requires_prescription: med.requires_prescription,
  };
}

function MedicineModal({
  pharmacyId,
  medicine,
  categories,
  onClose,
}: {
  pharmacyId: string;
  medicine: Medicine | null;
  categories: string[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isEdit = !!medicine;

  const [form, setForm] = useState<MedForm>(medicine ? toForm(medicine) : EMPTY_FORM);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState('');
  const [saving, setSaving] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const effectiveCategory = form.category === '__new__' ? newCategory : form.category;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!effectiveCategory.trim()) { toast.error('Veuillez sélectionner ou créer une catégorie'); return; }
    setSaving(true);
    try {
      let image_url = medicine?.image_url ?? null;
      if (imageFile) image_url = await uploadMedicineImage(imageFile);

      const payload = {
        name: form.name,
        description: form.description || null,
        category: effectiveCategory.trim(),
        price: parseFloat(form.price) || 0,
        stock: parseInt(form.stock, 10) || 0,
        requires_prescription: form.requires_prescription,
        image_url,
        is_active: true,
      };

      if (isEdit) {
        const { error } = await supabase.from('medicines').update(payload).eq('id', medicine.id);
        if (error) throw error;
        toast.success('Médicament modifié avec succès !');
      } else {
        const { error } = await supabase.from('medicines').insert({ ...payload, pharmacy_id: pharmacyId });
        if (error) throw error;
        toast.success('Médicament ajouté avec succès !');
      }

      queryClient.invalidateQueries({ queryKey: ['pharma-stock'] });
      queryClient.invalidateQueries({ queryKey: ['pharma-dashboard'] });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const currentImage = imagePreview ?? medicine?.image_url ?? null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier le médicament' : 'Ajouter un médicament'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Image upload zone */}
          <div>
            <Label className="mb-2 block">Image</Label>
            <div
              className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {currentImage ? (
                <img src={currentImage} alt="Aperçu" className="max-h-32 mx-auto rounded-lg object-contain" />
              ) : (
                <>
                  <ImagePlus className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 font-medium">Cliquer pour télécharger</p>
                  <p className="text-xs text-gray-400 mt-1">PNG, JPG jusqu'à 5 MB</p>
                </>
              )}
            </div>
            {currentImage && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 text-xs text-primary-600 hover:underline"
              >
                Changer l'image
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) { setImageFile(f); setImagePreview(URL.createObjectURL(f)); }
              }}
            />
          </div>

          {/* Nom */}
          <div className="space-y-1.5">
            <Label htmlFor="m-name">Nom du médicament *</Label>
            <Input
              id="m-name"
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              placeholder="Paracétamol 500mg"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="m-desc">Description</Label>
            <textarea
              id="m-desc"
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="Antalgique, antipyrétique..."
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
            />
          </div>

          {/* Catégorie */}
          <div className="space-y-1.5">
            <Label>Catégorie *</Label>
            <Select
              value={form.category}
              onValueChange={(v) => {
                setForm((p) => ({ ...p, category: v }));
                if (v !== '__new__') setNewCategory('');
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une catégorie" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
                <SelectItem value="__new__">+ Ajouter une catégorie</SelectItem>
              </SelectContent>
            </Select>
            {form.category === '__new__' && (
              <Input
                placeholder="Nom de la nouvelle catégorie"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="mt-2"
                autoFocus
              />
            )}
          </div>

          {/* Prix + Stock */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="m-price">Prix (FCFA) *</Label>
              <Input
                id="m-price"
                name="price"
                type="number"
                min="0"
                step="1"
                value={form.price}
                onChange={handleChange}
                required
                placeholder="1500"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-stock">Stock *</Label>
              <Input
                id="m-stock"
                name="stock"
                type="number"
                min="0"
                step="1"
                value={form.stock}
                onChange={handleChange}
                required
                placeholder="50"
              />
            </div>
          </div>

          {/* Ordonnance */}
          <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
            <input
              type="checkbox"
              checked={form.requires_prescription}
              onChange={(e) => setForm((prev) => ({ ...prev, requires_prescription: e.target.checked }))}
              className="mt-0.5 w-4 h-4 rounded border-gray-300 accent-green-600"
            />
            <div>
              <p className="text-sm font-medium text-gray-900">Nécessite une ordonnance</p>
              <p className="text-xs text-gray-400">Le client devra fournir une prescription médicale</p>
            </div>
          </label>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Annuler
            </Button>
            <Button type="submit" disabled={saving} className="bg-green-600 hover:bg-green-700 gap-1.5">
              {saving
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : isEdit ? 'Modifier' : 'Ajouter'
              }
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PharmaStock() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('__all__');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMed, setEditingMed] = useState<Medicine | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['pharma-stock'],
    queryFn: fetchStockData,
  });

  const deleteMedicine = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('medicines').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharma-stock'] });
      queryClient.invalidateQueries({ queryKey: ['pharma-dashboard'] });
      toast.success('Médicament supprimé');
    },
    onError: () => toast.error('Erreur lors de la suppression'),
  });

  const medicines = data?.medicines ?? [];
  const pharmacyId = data?.pharmacyId ?? null;

  const categories = useMemo(() => {
    const cats = medicines.map((m) => m.category).filter((c): c is string => !!c);
    return [...new Set(cats)].sort();
  }, [medicines]);

  const filtered = useMemo(() => {
    let list = medicines;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((m) => m.name.toLowerCase().includes(q) || (m.category ?? '').toLowerCase().includes(q));
    }
    if (categoryFilter && categoryFilter !== '__all__') {
      list = list.filter((m) => m.category === categoryFilter);
    }
    return list;
  }, [medicines, search, categoryFilter]);

  const openAdd = () => { setEditingMed(null); setModalOpen(true); };
  const openEdit = (med: Medicine) => { setEditingMed(med); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditingMed(null); };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stock</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {medicines.length} médicament{medicines.length !== 1 ? 's' : ''} au total
          </p>
        </div>
        <Button onClick={openAdd} className="bg-green-600 hover:bg-green-700 gap-2">
          <Plus className="h-4 w-4" />
          Ajouter
        </Button>
      </div>

      {/* Search + category filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Rechercher un médicament..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue placeholder="Toutes les catégories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Toutes les catégories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Medicine grid */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center shadow-sm">
          <Package className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">
            {medicines.length === 0 ? 'Aucun médicament dans le stock' : 'Aucun résultat'}
          </p>
          {medicines.length === 0 && (
            <Button className="mt-4 bg-green-600 hover:bg-green-700 gap-1.5" onClick={openAdd}>
              <Plus className="h-4 w-4" />
              Ajouter un médicament
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((med) => (
            <div
              key={med.id}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden group hover:shadow-md transition-shadow"
            >
              {/* Image */}
              <div className="relative">
                <div className="w-full aspect-square bg-gray-50 flex items-center justify-center overflow-hidden">
                  {med.image_url ? (
                    <img src={med.image_url} alt={med.name} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="h-10 w-10 text-gray-200" />
                  )}
                </div>
                {med.stock === 0 && (
                  <span className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    Rupture
                  </span>
                )}
                {/* Hover action buttons */}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEdit(med)}
                    className="w-7 h-7 bg-white shadow-md rounded-lg flex items-center justify-center text-gray-500 hover:text-primary-600 transition-colors"
                    title="Modifier"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Supprimer "${med.name}" ?`)) deleteMedicine.mutate(med.id);
                    }}
                    className="w-7 h-7 bg-white shadow-md rounded-lg flex items-center justify-center text-gray-500 hover:text-red-600 transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Info */}
              <div className="p-3">
                <p className="font-semibold text-gray-900 text-sm leading-tight truncate">{med.name}</p>
                {med.category && (
                  <span className="inline-block mt-1 text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full truncate max-w-full">
                    {med.category}
                  </span>
                )}
                <div className="flex items-center justify-between mt-2 gap-1">
                  <span className="text-sm font-bold text-gray-900">{formatPrice(med.price)}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                    med.stock === 0
                      ? 'bg-red-100 text-red-700'
                      : med.stock < 10
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-green-100 text-green-700'
                  }`}>
                    {med.stock} u.
                  </span>
                </div>
                {/* Mobile action buttons (always visible) */}
                <div className="flex gap-1.5 mt-2 sm:hidden">
                  <button
                    onClick={() => openEdit(med)}
                    className="flex-1 flex items-center justify-center gap-1 py-1 text-xs text-gray-500 bg-gray-50 rounded-lg hover:bg-primary-50 hover:text-primary-600 transition-colors"
                  >
                    <Pencil className="h-3 w-3" />
                    Modifier
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Supprimer "${med.name}" ?`)) deleteMedicine.mutate(med.id);
                    }}
                    className="flex-1 flex items-center justify-center gap-1 py-1 text-xs text-gray-500 bg-gray-50 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                    Supprimer
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && pharmacyId && (
        <MedicineModal
          pharmacyId={pharmacyId}
          medicine={editingMed}
          categories={categories}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
