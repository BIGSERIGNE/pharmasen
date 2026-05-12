import React, { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Package, ShoppingBag, TrendingUp, Clock, Phone, FileText,
  CheckCircle, XCircle, AlertCircle, Eye, Settings, Upload,
  Plus, Pencil, Trash2,
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
import { formatPrice, formatDate, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../lib/utils';
import type { Order, Medicine, Profile, Pharmacy } from '../types';

const CITIES = ['Dakar', 'Thiès', 'Saint-Louis', 'Ziguinchor', 'Kaolack', 'Diourbel'];

async function fetchPharmacistData() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non authentifié');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile?.pharmacy_id) return { orders: [], medicines: [], profile, pharmacy: null };

  const [{ data: orders }, { data: medicines }, { data: pharmacy }] = await Promise.all([
    supabase
      .from('orders')
      .select('*, profile:profiles(full_name, phone)')
      .eq('pharmacy_id', profile.pharmacy_id)
      .order('created_at', { ascending: false }),
    supabase
      .from('medicines')
      .select('*')
      .eq('pharmacy_id', profile.pharmacy_id)
      .order('name'),
    supabase
      .from('pharmacies')
      .select('*')
      .eq('id', profile.pharmacy_id)
      .single(),
  ]);

  return { orders: orders ?? [], medicines: medicines ?? [], profile, pharmacy: pharmacy ?? null };
}

const ORDER_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'] as const;

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number | string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
      <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center mb-3`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

// ─── Upload helpers ────────────────────────────────────────────────────────────

async function uploadMedicineImage(file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('medicine-images').upload(path, file, { upsert: true });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from('medicine-images').getPublicUrl(path);
  return publicUrl;
}

async function uploadPharmacyLogo(file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('pharmacy-images').upload(path, file, { upsert: true });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from('pharmacy-images').getPublicUrl(path);
  return publicUrl;
}

// ─── Modal Médicament ──────────────────────────────────────────────────────────

type MedicineForm = {
  name: string;
  description: string;
  category: string;
  price: string;
  stock: string;
  requires_prescription: boolean;
};

const EMPTY_MED_FORM: MedicineForm = {
  name: '', description: '', category: '', price: '', stock: '0', requires_prescription: false,
};

function toForm(med: Medicine): MedicineForm {
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
  onClose,
}: {
  pharmacyId: string;
  medicine: Medicine | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isEdit = !!medicine;
  const [form, setForm] = useState<MedicineForm>(medicine ? toForm(medicine) : EMPTY_MED_FORM);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      let image_url = medicine?.image_url ?? null;
      if (imageFile) image_url = await uploadMedicineImage(imageFile);

      const payload = {
        name: form.name,
        description: form.description || null,
        category: form.category || null,
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

      queryClient.invalidateQueries({ queryKey: ['pharma-dashboard'] });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const currentImage = imagePreview ?? medicine?.image_url;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier le médicament' : 'Ajouter un médicament'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Image */}
          <div className="space-y-1.5">
            <Label>Image</Label>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center flex-shrink-0">
                {currentImage
                  ? <img src={currentImage} alt="" className="w-full h-full object-cover" />
                  : <Package className="h-5 w-5 text-gray-300" />
                }
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
              >
                <Upload className="h-3.5 w-3.5" />
                {currentImage ? 'Changer' : 'Ajouter une image'}
              </button>
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
          </div>

          {/* Nom */}
          <div className="space-y-1.5">
            <Label htmlFor="m-name">Nom du médicament *</Label>
            <Input id="m-name" name="name" value={form.name} onChange={handleChange} required placeholder="Paracétamol 500mg" />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="m-desc">Description</Label>
            <Input id="m-desc" name="description" value={form.description} onChange={handleChange} placeholder="Antalgique, antipyrétique..." />
          </div>

          {/* Catégorie */}
          <div className="space-y-1.5">
            <Label htmlFor="m-cat">Catégorie</Label>
            <Input id="m-cat" name="category" value={form.category} onChange={handleChange} placeholder="Antalgiques, Antibiotiques..." />
          </div>

          {/* Prix + Stock */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="m-price">Prix (FCFA) *</Label>
              <Input id="m-price" name="price" type="number" min="0" step="1" value={form.price} onChange={handleChange} required placeholder="1500" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-stock">Stock *</Label>
              <Input id="m-stock" name="stock" type="number" min="0" step="1" value={form.stock} onChange={handleChange} required placeholder="50" />
            </div>
          </div>

          {/* Ordonnance */}
          <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
            <input
              type="checkbox"
              checked={form.requires_prescription}
              onChange={(e) => setForm((prev) => ({ ...prev, requires_prescription: e.target.checked }))}
              className="mt-0.5 w-4 h-4 rounded border-gray-300 accent-primary-600"
            />
            <div>
              <p className="text-sm font-medium text-gray-900">Nécessite une ordonnance</p>
              <p className="text-xs text-gray-400">Le client devra fournir une prescription médicale</p>
            </div>
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Annuler
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : isEdit ? 'Modifier' : 'Enregistrer'
              }
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Onglet Paramètres ─────────────────────────────────────────────────────────

function SettingsTab({ pharmacy }: { pharmacy: Pharmacy | null }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: pharmacy?.name ?? '',
    address: pharmacy?.address ?? '',
    city: pharmacy?.city ?? '',
    phone: pharmacy?.phone ?? '',
    email: pharmacy?.email ?? '',
    opening_hours: pharmacy?.opening_hours ?? '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!pharmacy) return;
    setSaving(true);
    try {
      let image_url = pharmacy.image_url;
      if (imageFile) {
        image_url = await uploadPharmacyLogo(imageFile);
      }
      const { error } = await supabase
        .from('pharmacies')
        .update({ ...form, email: form.email || null, opening_hours: form.opening_hours || null, image_url })
        .eq('id', pharmacy.id);
      if (error) throw error;
      toast.success('Pharmacie mise à jour avec succès !');
      queryClient.invalidateQueries({ queryKey: ['pharma-dashboard'] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  if (!pharmacy) return <p className="text-center text-gray-400 py-12">Pharmacie introuvable</p>;

  const currentImage = imagePreview ?? pharmacy.image_url;

  return (
    <form onSubmit={handleSave} className="max-w-lg space-y-5">
      {/* Logo */}
      <div className="space-y-1.5">
        <Label>Logo / Photo</Label>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center flex-shrink-0">
            {currentImage
              ? <img src={currentImage} alt="Logo" className="w-full h-full object-cover" />
              : <Upload className="h-6 w-6 text-gray-300" />
            }
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
          >
            <Upload className="h-4 w-4" />
            {currentImage ? 'Changer le logo' : 'Ajouter un logo'}
          </button>
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
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="s-name">Nom de la pharmacie</Label>
        <Input id="s-name" name="name" value={form.name} onChange={handleChange} required />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="s-address">Adresse</Label>
          <Input id="s-address" name="address" value={form.address} onChange={handleChange} required />
        </div>
        <div className="space-y-1.5">
          <Label>Ville</Label>
          <Select value={form.city} onValueChange={(v) => setForm((p) => ({ ...p, city: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CITIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="s-phone">Téléphone</Label>
          <Input id="s-phone" name="phone" type="tel" value={form.phone} onChange={handleChange} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-email">Email</Label>
          <Input id="s-email" name="email" type="email" value={form.email} onChange={handleChange} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="s-hours">Horaires d'ouverture</Label>
        <Input id="s-hours" name="opening_hours" placeholder="Lun-Sam : 8h-20h" value={form.opening_hours} onChange={handleChange} />
      </div>

      <Button type="submit" disabled={saving} className="w-full sm:w-auto">
        {saving
          ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          : 'Sauvegarder les modifications'
        }
      </Button>
    </form>
  );
}

export default function PharmaDashboard() {
  const queryClient = useQueryClient();
  const [medicineModalOpen, setMedicineModalOpen] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);

  const openAdd = () => { setEditingMedicine(null); setMedicineModalOpen(true); };
  const openEdit = (med: Medicine) => { setEditingMedicine(med); setMedicineModalOpen(true); };
  const closeModal = () => { setMedicineModalOpen(false); setEditingMedicine(null); };

  const { data, isLoading } = useQuery({
    queryKey: ['pharma-dashboard'],
    queryFn: fetchPharmacistData,
  });

  const deleteMedicine = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('medicines').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharma-dashboard'] });
      toast.success('Médicament supprimé');
    },
    onError: () => toast.error('Erreur lors de la suppression'),
  });

  const updateOrderStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('orders').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharma-dashboard'] });
      toast.success('Statut mis à jour');
    },
    onError: () => toast.error('Erreur lors de la mise à jour'),
  });

  const updatePrescriptionStatus = useMutation({
    mutationFn: async ({ id, prescription_status }: { id: string; prescription_status: string }) => {
      const { error } = await supabase.from('orders').update({ prescription_status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharma-dashboard'] });
      toast.success('Ordonnance mise à jour');
    },
    onError: () => toast.error('Erreur lors de la mise à jour'),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const { orders = [], medicines = [], profile, pharmacy = null } = data ?? {};

  if (!profile?.pharmacy_id) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Aucune pharmacie associée</h2>
        <p className="text-gray-500">Votre compte n'est pas encore lié à une pharmacie. Contactez l'administrateur.</p>
      </div>
    );
  }

  const pendingOrders = orders.filter((o: Order) => o.status === 'pending');
  const todayOrders = orders.filter((o: Order) => {
    const today = new Date().toDateString();
    return new Date(o.created_at).toDateString() === today;
  });
  const lowStockMeds = medicines.filter((m: Medicine) => m.stock < 10 && m.stock > 0);
  const totalRevenue = orders
    .filter((o: Order) => o.status === 'delivered')
    .reduce((sum: number, o: Order) => sum + o.total, 0);

  const pendingPrescriptions = orders.filter(
    (o: Order) => o.prescription_status === 'pending' && o.prescription_url
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Gérez votre pharmacie</p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="w-full mb-6 grid grid-cols-5">
          <TabsTrigger value="overview">Vue générale</TabsTrigger>
          <TabsTrigger value="orders">
            Commandes
            {pendingOrders.length > 0 && (
              <span className="ml-1.5 bg-primary-600 text-white text-xs rounded-full px-1.5 py-0.5">
                {pendingOrders.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="stock">Stock</TabsTrigger>
          <TabsTrigger value="prescriptions">
            Ordo.
            {pendingPrescriptions.length > 0 && (
              <span className="ml-1.5 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5">
                {pendingPrescriptions.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5">
            <Settings className="h-3.5 w-3.5" />
            Paramètres
          </TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard icon={ShoppingBag} label="Commandes aujourd'hui" value={todayOrders.length} color="bg-blue-500" />
            <StatCard icon={Clock} label="En attente" value={pendingOrders.length} color="bg-amber-500" />
            <StatCard icon={Package} label="Stock faible" value={lowStockMeds.length} color="bg-red-500" />
            <StatCard icon={TrendingUp} label="Chiffre d'affaires" value={formatPrice(totalRevenue)} color="bg-primary-600" />
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4">Dernières commandes</h3>
            {orders.slice(0, 5).map((order: Order) => (
              <div key={order.id} className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">Commande #{order.id.slice(-8).toUpperCase()}</p>
                  <p className="text-xs text-gray-500">{formatDate(order.created_at)}</p>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${ORDER_STATUS_COLORS[order.status]}`}>
                  {ORDER_STATUS_LABELS[order.status]}
                </span>
                <span className="text-sm font-semibold text-gray-700">{formatPrice(order.total)}</span>
              </div>
            ))}
            {orders.length === 0 && <p className="text-gray-400 text-sm text-center py-4">Aucune commande</p>}
          </div>
        </TabsContent>

        {/* Orders */}
        <TabsContent value="orders">
          <div className="space-y-4">
            {orders.length === 0 ? (
              <p className="text-center text-gray-400 py-12">Aucune commande</p>
            ) : (
              orders.map((order: Order) => (
                <div key={order.id} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="font-semibold text-gray-900">#{order.id.slice(-8).toUpperCase()}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{formatDate(order.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${ORDER_STATUS_COLORS[order.status]}`}>
                        {ORDER_STATUS_LABELS[order.status]}
                      </span>
                      <span className="font-semibold text-primary-600">{formatPrice(order.total)}</span>
                    </div>
                  </div>

                  {/* Client info */}
                  {order.profile && (
                    <div className="flex items-center gap-3 text-sm text-gray-600 mb-3 bg-gray-50 rounded-lg p-2">
                      <span>{(order.profile as unknown as Profile).full_name ?? 'Client'}</span>
                      {(order.profile as unknown as Profile).phone && (
                        <a href={`tel:${(order.profile as unknown as Profile).phone}`} className="flex items-center gap-1 text-primary-600">
                          <Phone className="h-3.5 w-3.5" />
                          {(order.profile as unknown as Profile).phone}
                        </a>
                      )}
                    </div>
                  )}

                  {/* Items */}
                  <div className="mb-3 space-y-1">
                    {order.items.map((item) => (
                      <div key={item.medicine_id} className="flex justify-between text-sm text-gray-600">
                        <span>{item.medicine_name} × {item.quantity}</span>
                        <span>{formatPrice(item.price * item.quantity)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Status update */}
                  {order.status !== 'delivered' && order.status !== 'cancelled' && (
                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
                      {ORDER_STATUSES.filter((s) => s !== order.status).map((status) => (
                        <Button
                          key={status}
                          size="sm"
                          variant={status === 'cancelled' ? 'destructive' : status === 'delivered' ? 'default' : 'outline'}
                          onClick={() => updateOrderStatus.mutate({ id: order.id, status })}
                          disabled={updateOrderStatus.isPending}
                        >
                          {ORDER_STATUS_LABELS[status]}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </TabsContent>

        {/* Stock */}
        <TabsContent value="stock">
          {/* En-tête + bouton ajout */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500 font-medium">
              {medicines.length} produit{medicines.length !== 1 ? 's' : ''}
            </p>
            <Button size="sm" onClick={openAdd} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Ajouter un médicament
            </Button>
          </div>

          {/* Alerte stock faible */}
          {lowStockMeds.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
              <p className="text-red-700 font-semibold text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {lowStockMeds.length} médicament{lowStockMeds.length > 1 ? 's' : ''} en stock faible
              </p>
            </div>
          )}

          {/* Liste vide */}
          {medicines.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-12 text-center shadow-sm">
              <Package className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Aucun médicament dans le stock</p>
              <p className="text-gray-400 text-sm mt-1">Commencez par ajouter vos premiers médicaments</p>
              <Button className="mt-4 gap-1.5" onClick={openAdd}>
                <Plus className="h-4 w-4" />
                Ajouter un médicament
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {medicines.map((med: Medicine) => (
                <div key={med.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4 shadow-sm">
                  {/* Image */}
                  <div className="w-12 h-12 rounded-lg bg-gray-50 border border-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {med.image_url
                      ? <img src={med.image_url} alt={med.name} className="w-full h-full object-cover" />
                      : <Package className="h-5 w-5 text-gray-300" />
                    }
                  </div>

                  {/* Infos */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-gray-900 text-sm">{med.name}</p>
                      {med.requires_prescription && (
                        <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">
                          Ordonnance requise
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {med.category ?? 'Non catégorisé'} · {formatPrice(med.price)}
                    </p>
                  </div>

                  {/* Badge stock */}
                  <div className={`text-sm font-semibold px-3 py-1 rounded-full flex-shrink-0 ${
                    med.stock === 0 ? 'bg-red-100 text-red-700' :
                    med.stock < 10 ? 'bg-amber-100 text-amber-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {med.stock} unité{med.stock !== 1 ? 's' : ''}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => openEdit(med)}
                      className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                      title="Modifier"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Supprimer "${med.name}" ?`)) {
                          deleteMedicine.mutate(med.id);
                        }
                      }}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Prescriptions */}
        <TabsContent value="prescriptions">
          <div className="space-y-4">
            {pendingPrescriptions.length === 0 ? (
              <p className="text-center text-gray-400 py-12">Aucune ordonnance en attente</p>
            ) : (
              pendingPrescriptions.map((order: Order) => (
                <div key={order.id} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="font-semibold text-gray-900">#{order.id.slice(-8).toUpperCase()}</p>
                      <p className="text-xs text-gray-500">{formatDate(order.created_at)}</p>
                    </div>
                    {order.profile && (
                      <a
                        href={`tel:${(order.profile as unknown as Profile).phone}`}
                        className="flex items-center gap-1.5 bg-primary-50 text-primary-700 text-sm px-3 py-1.5 rounded-lg hover:bg-primary-100 transition-colors"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        Appeler le client
                      </a>
                    )}
                  </div>

                  {order.prescription_note && (
                    <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 mb-3">
                      <FileText className="h-4 w-4 inline mr-1 text-gray-400" />
                      {order.prescription_note}
                    </p>
                  )}

                  {order.prescription_url && (
                    <a
                      href={order.prescription_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-primary-600 hover:underline mb-4"
                    >
                      <Eye className="h-4 w-4" />
                      Voir l'ordonnance
                    </a>
                  )}

                  <div className="flex gap-2 pt-3 border-t border-gray-100">
                    <Button
                      className="flex-1 gap-1.5"
                      onClick={() => updatePrescriptionStatus.mutate({ id: order.id, prescription_status: 'approved' })}
                      disabled={updatePrescriptionStatus.isPending}
                    >
                      <CheckCircle className="h-4 w-4" />
                      Valider
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1 gap-1.5"
                      onClick={() => updatePrescriptionStatus.mutate({ id: order.id, prescription_status: 'rejected' })}
                      disabled={updatePrescriptionStatus.isPending}
                    >
                      <XCircle className="h-4 w-4" />
                      Refuser
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>
        {/* Settings */}
        <TabsContent value="settings">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Paramètres de la pharmacie</h2>
            <p className="text-sm text-gray-500 mb-6">Modifiez les informations visibles par les clients.</p>
            <SettingsTab pharmacy={pharmacy as Pharmacy | null} />
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal ajout/modification médicament */}
      {medicineModalOpen && profile?.pharmacy_id && (
        <MedicineModal
          pharmacyId={profile.pharmacy_id}
          medicine={editingMedicine}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
