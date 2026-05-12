import React, { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Package, ShoppingBag, TrendingUp, Clock, Phone, FileText,
  CheckCircle, XCircle, AlertCircle, Eye, Settings, Upload,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
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

async function uploadPharmacyLogo(file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('pharmacy-images').upload(path, file, { upsert: true });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from('pharmacy-images').getPublicUrl(path);
  return publicUrl;
}

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
  const { data, isLoading } = useQuery({
    queryKey: ['pharma-dashboard'],
    queryFn: fetchPharmacistData,
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
          <div className="space-y-3">
            {lowStockMeds.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                <p className="text-red-700 font-semibold text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {lowStockMeds.length} médicament{lowStockMeds.length > 1 ? 's' : ''} en stock faible
                </p>
              </div>
            )}
            {medicines.map((med: Medicine) => (
              <div key={med.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3 shadow-sm">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm">{med.name}</p>
                  <p className="text-xs text-gray-500">{med.category ?? 'Non catégorisé'} · {formatPrice(med.price)}</p>
                </div>
                <div className={`text-sm font-semibold px-3 py-1 rounded-full ${
                  med.stock === 0 ? 'bg-red-100 text-red-700' :
                  med.stock < 10 ? 'bg-amber-100 text-amber-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {med.stock} unité{med.stock > 1 ? 's' : ''}
                </div>
              </div>
            ))}
            {medicines.length === 0 && (
              <p className="text-center text-gray-400 py-12">Aucun médicament dans le stock</p>
            )}
          </div>
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
    </div>
  );
}
