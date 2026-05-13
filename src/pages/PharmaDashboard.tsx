import React, { useRef, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ChevronLeft, ChevronRight, TrendingUp, Phone, FileText,
  CheckCircle, XCircle, Eye, Settings, Upload, AlertCircle,
  ArrowRight,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { supabase } from '../lib/supabaseClient';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import { formatPrice, formatDate, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../lib/utils';
import type { Order, Medicine, Pharmacy } from '../types';

const CITIES = ['Dakar', 'Thiès', 'Saint-Louis', 'Ziguinchor', 'Kaolack', 'Diourbel'];

// ─── Data fetch ───────────────────────────────────────────────────────────────

type ClientInfo = { full_name: string | null; phone: string | null };

async function fetchPharmacistData() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Non authentifié');

  const { data: profile } = await supabase
    .from('profiles')
    .select('pharmacy_id')
    .eq('id', session.user.id)
    .single();

  if (!profile?.pharmacy_id) {
    return { orders: [] as Order[], medicines: [] as Medicine[], pharmacy: null, clients: {} as Record<string, ClientInfo> };
  }

  const [{ data: orders }, { data: medicines }, { data: pharmacy }] = await Promise.all([
    supabase
      .from('orders')
      .select('*')
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

  // Fetch client names separately using client_id from each order
  const clientIds = [...new Set((orders ?? []).map((o: { client_id: string }) => o.client_id).filter(Boolean))];
  let clients: Record<string, ClientInfo> = {};
  if (clientIds.length > 0) {
    const { data: clientProfiles } = await supabase
      .from('profiles')
      .select('id, full_name, phone')
      .in('id', clientIds);
    if (clientProfiles) {
      clients = Object.fromEntries(
        clientProfiles.map((p: { id: string; full_name: string | null; phone: string | null }) => [
          p.id, { full_name: p.full_name, phone: p.phone },
        ])
      );
    }
  }

  return {
    orders: (orders ?? []) as Order[],
    medicines: (medicines ?? []) as Medicine[],
    pharmacy: pharmacy ?? null,
    clients,
  };
}

// ─── Period helpers ───────────────────────────────────────────────────────────

type Period = 'day' | 'week' | 'month' | 'year';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'day', label: "Aujourd'hui" },
  { key: 'week', label: 'Cette semaine' },
  { key: 'month', label: 'Ce mois' },
  { key: 'year', label: 'Cette année' },
];

function getDateRange(period: Period, offset: number): { start: Date; end: Date; label: string } {
  const now = new Date();
  switch (period) {
    case 'day': {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
      const start = new Date(d);
      const end = new Date(start.getTime() + 86400000 - 1);
      return {
        start,
        end,
        label: offset === 0
          ? "Aujourd'hui"
          : d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
      };
    }
    case 'week': {
      const dow = now.getDay() === 0 ? 6 : now.getDay() - 1;
      const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow + offset * 7);
      const start = new Date(mon);
      const end = new Date(start.getTime() + 7 * 86400000 - 1);
      return {
        start,
        end,
        label: offset === 0
          ? 'Cette semaine'
          : `${start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`,
      };
    }
    case 'month': {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      return {
        start,
        end,
        label: offset === 0
          ? 'Ce mois'
          : d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
      };
    }
    case 'year': {
      const year = now.getFullYear() + offset;
      return {
        start: new Date(year, 0, 1),
        end: new Date(year, 11, 31, 23, 59, 59),
        label: offset === 0 ? 'Cette année' : String(year),
      };
    }
  }
}

function buildChartData(orders: Order[], period: Period, range: { start: Date; end: Date }) {
  const delivered = orders.filter(o => {
    const d = new Date(o.created_at);
    return o.status === 'delivered' && d >= range.start && d <= range.end;
  });

  if (period === 'day') {
    return Array.from({ length: 8 }, (_, i) => {
      const h = i * 3;
      return {
        name: `${h}h`,
        ventes: delivered
          .filter(o => { const hr = new Date(o.created_at).getHours(); return hr >= h && hr < h + 3; })
          .reduce((s, o) => s + o.total, 0),
      };
    });
  }

  if (period === 'week') {
    return ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((name, i) => {
      const ds = new Date(range.start.getTime() + i * 86400000);
      const de = new Date(ds.getTime() + 86400000 - 1);
      return {
        name,
        ventes: delivered.filter(o => { const d = new Date(o.created_at); return d >= ds && d <= de; })
          .reduce((s, o) => s + o.total, 0),
      };
    });
  }

  if (period === 'month') {
    const days = new Date(range.start.getFullYear(), range.start.getMonth() + 1, 0).getDate();
    return Array.from({ length: days }, (_, i) => ({
      name: String(i + 1),
      ventes: delivered.filter(o => new Date(o.created_at).getDate() === i + 1).reduce((s, o) => s + o.total, 0),
    }));
  }

  return ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'].map((name, i) => ({
    name,
    ventes: delivered.filter(o => new Date(o.created_at).getMonth() === i).reduce((s, o) => s + o.total, 0),
  }));
}

// ─── Upload helpers ───────────────────────────────────────────────────────────

async function uploadPharmacyLogo(file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('pharmacy-images').upload(path, file, { upsert: true });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from('pharmacy-images').getPublicUrl(path);
  return publicUrl;
}

// ─── Onglet Paramètres ────────────────────────────────────────────────────────

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
      if (imageFile) image_url = await uploadPharmacyLogo(imageFile);
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

// ─── Main component ───────────────────────────────────────────────────────────

export default function PharmaDashboard() {
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<Period>('month');
  const [dateOffset, setDateOffset] = useState(0);
  const [activeTab, setActiveTab] = useState('overview');

  const { data, isLoading } = useQuery({
    queryKey: ['pharma-dashboard'],
    queryFn: fetchPharmacistData,
  });

  const updateOrderStatus = useMutation({
    mutationFn: async ({ id, status, items }: { id: string; status: string; items?: Order['items'] }) => {
      // Deduce stock before confirming
      if (status === 'confirmed' && items && items.length > 0) {
        for (const item of items) {
          try {
            const { data: med } = await supabase
              .from('medicines')
              .select('stock')
              .eq('id', item.medicine_id)
              .single();

            if (med) {
              const newStock = Math.max(0, (med as { stock: number }).stock - item.quantity);
              const { error: stockError } = await supabase
                .from('medicines')
                .update({ stock: newStock })
                .eq('id', item.medicine_id);

              if (stockError) {
                console.warn(`[Stock] Erreur mise à jour pour ${item.medicine_name}:`, stockError);
                toast.warning(`Stock de "${item.medicine_name}" non mis à jour`);
              }
            }
          } catch (err) {
            console.warn(`[Stock] Exception pour ${item.medicine_name}:`, err);
            toast.warning(`Stock de "${item.medicine_name}" non mis à jour`);
          }
        }
      }

      const { error } = await supabase.from('orders').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharma-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['pharma-stock'] });
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

  const dateRange = useMemo(() => getDateRange(period, dateOffset), [period, dateOffset]);

  const handlePeriodChange = (p: Period) => {
    setPeriod(p);
    setDateOffset(0);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const { orders = [], medicines = [], pharmacy = null, clients = {} } = data ?? {};

  // fetchPharmacistData returns null orders/pharmacy when pharmacy_id missing
  if (!pharmacy) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Aucune pharmacie associée</h2>
        <p className="text-gray-500">Votre compte n'est pas encore lié à une pharmacie. Contactez l'administrateur.</p>
      </div>
    );
  }

  // Period-filtered data
  const periodOrders = (orders as Order[]).filter(o => {
    const d = new Date(o.created_at);
    return d >= dateRange.start && d <= dateRange.end;
  });

  const periodRevenue = periodOrders
    .filter(o => o.status === 'delivered')
    .reduce((sum, o) => sum + o.total, 0);
  const periodDelivered = periodOrders.filter(o => o.status === 'delivered').length;
  const periodPending = periodOrders.filter(o => o.status === 'pending').length;
  const periodConfirmed = periodOrders.filter(o => o.status === 'confirmed').length;
  const periodReady = periodOrders.filter(o => o.status === 'ready').length;

  // Today revenue (always today regardless of selected period)
  const todayStr = new Date().toDateString();
  const todayRevenue = (orders as Order[])
    .filter(o => new Date(o.created_at).toDateString() === todayStr && o.status === 'delivered')
    .reduce((sum, o) => sum + o.total, 0);

  // Active orders (not completed/cancelled)
  const activeOrders = (orders as Order[]).filter(o => !['delivered', 'cancelled'].includes(o.status));

  // Stock alerts
  const ruptureMeds = (medicines as Medicine[]).filter(m => m.stock === 0);
  const lowMeds = (medicines as Medicine[]).filter(m => m.stock > 0 && m.stock < 10);
  const alertMeds = [...ruptureMeds, ...lowMeds];

  // Prescriptions
  const pendingPrescriptions = (orders as Order[]).filter(
    o => o.prescription_status === 'pending' && o.prescription_url
  );

  const chartData = buildChartData(orders as Order[], period, dateRange);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          <TabsTrigger value="overview" className="rounded-lg px-4">Vue générale</TabsTrigger>
          <TabsTrigger value="orders" className="rounded-lg px-4">
            Commandes
            {activeOrders.length > 0 && (
              <span className="ml-1.5 bg-primary-600 text-white text-xs rounded-full px-1.5 py-0.5">
                {activeOrders.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="prescriptions" className="rounded-lg px-4">
            Ordonnances
            {pendingPrescriptions.length > 0 && (
              <span className="ml-1.5 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5">
                {pendingPrescriptions.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="settings" className="rounded-lg px-4 gap-1.5">
            <Settings className="h-3.5 w-3.5" />
            Paramètres
          </TabsTrigger>
        </TabsList>

        {/* ── Vue générale ── */}
        <TabsContent value="overview" className="space-y-6">
          {/* Period selector + date navigation */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
              {PERIODS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => handlePeriodChange(key)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                    period === key
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={() => setDateOffset(o => o - 1)}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-medium text-gray-700 min-w-[120px] text-center">
                {dateRange.label}
              </span>
              <button
                onClick={() => setDateOffset(o => Math.min(0, o + 1))}
                disabled={dateOffset >= 0}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Green CA card */}
            <div className="bg-green-600 rounded-2xl p-6 text-white">
              <p className="text-sm text-green-100">Chiffre d'affaires</p>
              <p className="text-3xl font-bold mt-2">{formatPrice(periodRevenue)}</p>
              <div className="flex items-center gap-1.5 mt-3 text-sm text-green-100">
                <TrendingUp className="h-4 w-4" />
                {periodDelivered} commande{periodDelivered !== 1 ? 's' : ''} livrée{periodDelivered !== 1 ? 's' : ''}
              </div>
            </div>

            {/* CA du jour */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <p className="text-sm text-gray-500">CA du jour</p>
              <p className="text-2xl font-bold mt-2 text-gray-900">{formatPrice(todayRevenue)}</p>
              <p className="text-xs text-gray-400 mt-2">
                {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>

            {/* Commandes with sub-stats */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <p className="text-sm text-gray-500 mb-3">Commandes</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { dot: 'bg-orange-500', label: 'En attente', count: periodPending },
                  { dot: 'bg-blue-500', label: 'Acceptées', count: periodConfirmed },
                  { dot: 'bg-emerald-400', label: 'Prêtes', count: periodReady },
                  { dot: 'bg-green-600', label: 'Livrées', count: periodDelivered },
                ].map(({ dot, label, count }) => (
                  <div key={label} className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
                    <div>
                      <p className="text-xs text-gray-400">{label}</p>
                      <p className="text-lg font-bold text-gray-900 leading-tight">{count}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bar chart */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-5">Évolution Des Ventes</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  interval={period === 'month' ? 4 : 0}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                  width={40}
                />
                <Tooltip
                  formatter={(value: unknown) => [
                    `${new Intl.NumberFormat('fr-FR').format(value as number)} FCFA`,
                    'Ventes',
                  ]}
                  contentStyle={{ borderRadius: '10px', border: '1px solid #e5e7eb', padding: '8px 12px' }}
                  labelStyle={{ fontWeight: 600, fontSize: 13 }}
                  cursor={{ fill: '#f0fdf4' }}
                />
                <Bar dataKey="ventes" fill="#16a34a" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 2-column bottom */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Commandes en cours */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Commandes en cours</h3>
                <button
                  onClick={() => setActiveTab('orders')}
                  className="flex items-center gap-1 text-sm text-green-600 hover:text-green-700 font-medium"
                >
                  Gérer <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
              {activeOrders.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-6">Aucune commande en cours</p>
              ) : (
                activeOrders.slice(0, 6).map((order: Order) => (
                  <div key={order.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0 gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">#{order.id.slice(-6).toUpperCase()}</p>
                      <p className="text-xs text-gray-400 truncate">
                        {clients[order.client_id]?.full_name ?? 'Client'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ORDER_STATUS_COLORS[order.status]}`}>
                        {ORDER_STATUS_LABELS[order.status]}
                      </span>
                      <span className="text-sm font-semibold text-gray-700">{formatPrice(order.total)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Alertes stock */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Alertes stock</h3>
                <Link
                  to="/pharma/stock"
                  className="flex items-center gap-1 text-sm text-green-600 hover:text-green-700 font-medium"
                >
                  Gérer <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              {alertMeds.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-6">Aucune alerte de stock</p>
              ) : (
                alertMeds.slice(0, 6).map((med: Medicine) => (
                  <div key={med.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0 gap-2">
                    <p className="text-sm font-medium text-gray-900 truncate">{med.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                      med.stock === 0
                        ? 'bg-red-100 text-red-700'
                        : 'bg-orange-100 text-orange-700'
                    }`}>
                      {med.stock === 0 ? 'Rupture' : `${med.stock} unités`}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── Commandes ── */}
        <TabsContent value="orders">
          <div className="space-y-4">
            {orders.length === 0 ? (
              <p className="text-center text-gray-400 py-12">Aucune commande</p>
            ) : (
              orders.map((order: Order) => {
                const client = clients[order.client_id];
                const orderDate = new Date(order.created_at);
                const dateStr = orderDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
                const timeStr = orderDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                return (
                  <div key={order.id} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                    {/* Header */}
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="font-semibold text-gray-900">#{order.id.slice(-8).toUpperCase()}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{dateStr} · {timeStr}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${ORDER_STATUS_COLORS[order.status]}`}>
                          {ORDER_STATUS_LABELS[order.status]}
                        </span>
                        <span className="font-semibold text-primary-600">{formatPrice(order.total)}</span>
                      </div>
                    </div>

                    {/* Client info */}
                    <div className="flex items-center gap-3 text-sm text-gray-600 mb-3 bg-gray-50 rounded-lg p-2">
                      <span className="font-medium">{client?.full_name ?? 'Client inconnu'}</span>
                      {client?.phone && (
                        <a href={`tel:${client.phone}`} className="flex items-center gap-1 text-primary-600 hover:underline">
                          <Phone className="h-3.5 w-3.5" />
                          {client.phone}
                        </a>
                      )}
                    </div>

                    {/* Items */}
                    <div className="mb-3 space-y-1">
                      {order.items.map((item) => (
                        <div key={item.medicine_id} className="flex justify-between text-sm text-gray-600">
                          <span>{item.medicine_name} × {item.quantity}</span>
                          <span>{formatPrice(item.price * item.quantity)}</span>
                        </div>
                      ))}
                    </div>

                    {/* Status action buttons */}
                    {order.status !== 'delivered' && order.status !== 'cancelled' && (
                      <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
                        {order.status === 'pending' && (
                          <Button
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700"
                            onClick={() => updateOrderStatus.mutate({ id: order.id, status: 'confirmed', items: order.items })}
                            disabled={updateOrderStatus.isPending}
                          >
                            Accepter
                          </Button>
                        )}
                        {order.status === 'confirmed' && (
                          <Button
                            size="sm"
                            className="bg-emerald-500 hover:bg-emerald-600"
                            onClick={() => updateOrderStatus.mutate({ id: order.id, status: 'ready' })}
                            disabled={updateOrderStatus.isPending}
                          >
                            Prêt
                          </Button>
                        )}
                        {order.status === 'ready' && (
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => updateOrderStatus.mutate({ id: order.id, status: 'delivered' })}
                            disabled={updateOrderStatus.isPending}
                          >
                            Livré
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => updateOrderStatus.mutate({ id: order.id, status: 'cancelled' })}
                          disabled={updateOrderStatus.isPending}
                        >
                          Annuler
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </TabsContent>

        {/* ── Ordonnances ── */}
        <TabsContent value="prescriptions">
          <div className="space-y-4">
            {pendingPrescriptions.length === 0 ? (
              <p className="text-center text-gray-400 py-12">Aucune ordonnance en attente</p>
            ) : (
              pendingPrescriptions.map((order: Order) => {
                const client = clients[order.client_id];
                return (
                <div key={order.id} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <p className="font-semibold text-gray-900">#{order.id.slice(-8).toUpperCase()}</p>
                      <p className="text-xs text-gray-500">{formatDate(order.created_at)}</p>
                      {client?.full_name && (
                        <p className="text-sm text-gray-600 mt-0.5">{client.full_name}</p>
                      )}
                    </div>
                    {client?.phone && (
                      <a
                        href={`tel:${client.phone}`}
                        className="flex items-center gap-1.5 bg-primary-50 text-primary-700 text-sm px-3 py-1.5 rounded-lg hover:bg-primary-100 transition-colors"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        Appeler le client
                      </a>
                    )}
                  </div>

                  {/* Prescription image */}
                  {order.prescription_url && (
                    <a
                      href={order.prescription_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block mb-4"
                    >
                      <div className="relative w-full max-w-xs rounded-xl overflow-hidden border border-gray-200 bg-gray-50 group">
                        <img
                          src={order.prescription_url}
                          alt="Ordonnance"
                          className="w-full h-40 object-cover group-hover:opacity-90 transition-opacity"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                          <Eye className="h-6 w-6 text-white" />
                        </div>
                      </div>
                      <p className="flex items-center gap-1 text-xs text-primary-600 mt-1">
                        <Eye className="h-3.5 w-3.5" />
                        Voir en grand
                      </p>
                    </a>
                  )}

                  {order.prescription_note && (
                    <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 mb-4">
                      <FileText className="h-4 w-4 inline mr-1 text-gray-400" />
                      {order.prescription_note}
                    </p>
                  )}

                  <div className="flex gap-2 pt-3 border-t border-gray-100">
                    <Button
                      className="flex-1 gap-1.5 bg-green-600 hover:bg-green-700"
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
                );
              })
            )}
          </div>
        </TabsContent>

        {/* ── Paramètres ── */}
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
