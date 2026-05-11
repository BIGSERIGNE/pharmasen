import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Search, ShoppingCart, Plus, AlertCircle, MapPin, Phone, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabaseClient';
import { useCart } from '../components/CartContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { formatPrice } from '../lib/utils';
import type { Pharmacy, Medicine } from '../types';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '../components/ui/dialog';

async function fetchPharmacy(id: string): Promise<Pharmacy> {
  const { data, error } = await supabase.from('pharmacies').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

async function fetchMedicines(pharmacyId: string): Promise<Medicine[]> {
  const { data, error } = await supabase
    .from('medicines')
    .select('*')
    .eq('pharmacy_id', pharmacyId)
    .eq('is_active', true)
    .order('category')
    .order('name');
  if (error) throw error;
  return data;
}

export default function PharmacyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { cart, addToCart, clearCart } = useCart();
  const [search, setSearch] = useState('');
  const [conflictMedicine, setConflictMedicine] = useState<Medicine | null>(null);

  const { data: pharmacy } = useQuery({
    queryKey: ['pharmacy', id],
    queryFn: () => fetchPharmacy(id!),
    enabled: !!id,
  });

  const { data: medicines = [] } = useQuery({
    queryKey: ['medicines', id],
    queryFn: () => fetchMedicines(id!),
    enabled: !!id,
  });

  const handleAddToCart = (medicine: Medicine) => {
    if (medicine.stock === 0) {
      toast.error('Ce médicament est en rupture de stock');
      return;
    }
    const success = addToCart(medicine, pharmacy?.name ?? '');
    if (!success) {
      setConflictMedicine(medicine);
    } else {
      toast.success(`${medicine.name} ajouté au panier`);
    }
  };

  const handleConfirmSwitch = () => {
    if (!conflictMedicine || !pharmacy) return;
    clearCart();
    addToCart(conflictMedicine, pharmacy.name);
    toast.success(`${conflictMedicine.name} ajouté au panier`);
    setConflictMedicine(null);
  };

  const filtered = medicines.filter(
    (m) =>
      search === '' ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      (m.category ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const grouped = filtered.reduce<Record<string, Medicine[]>>((acc, m) => {
    const cat = m.category ?? 'Autres';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(m);
    return acc;
  }, {});

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 md:top-16 z-30">
        <div className="px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold text-gray-900 truncate flex-1">{pharmacy?.name ?? 'Pharmacie'}</h1>
          <Button variant="ghost" size="icon" onClick={() => navigate('/cart')} className="relative">
            <ShoppingCart className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="px-4 py-6">
        {/* Pharmacy info */}
        {pharmacy && (
          <div className="bg-primary-50 rounded-2xl p-4 mb-6 flex gap-4">
            <div className="w-14 h-14 rounded-xl bg-white flex items-center justify-center flex-shrink-0 shadow-sm overflow-hidden">
              {pharmacy.image_url ? (
                <img src={pharmacy.image_url} alt={pharmacy.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl">🏥</span>
              )}
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-gray-900">{pharmacy.name}</h2>
              <div className="flex items-center gap-1 text-sm text-gray-600 mt-0.5">
                <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{pharmacy.address}, {pharmacy.city}</span>
              </div>
              <div className="flex gap-3 mt-1">
                {pharmacy.phone && (
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Phone className="h-3 w-3" />{pharmacy.phone}
                  </div>
                )}
                {pharmacy.opening_hours && (
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock className="h-3 w-3" />{pharmacy.opening_hours}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Rechercher un médicament..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Medicines by category */}
        {Object.keys(grouped).length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">💊</div>
            <p className="text-gray-500">Aucun médicament trouvé</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(grouped).map(([category, meds]) => (
              <div key={category}>
                <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-1 h-5 bg-primary-600 rounded-full" />
                  {category}
                </h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  {meds.map((med) => (
                    <div
                      key={med.id}
                      className="bg-white rounded-xl border border-gray-100 p-4 flex gap-3 shadow-sm"
                    >
                      <div className="w-12 h-12 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {med.image_url ? (
                          <img src={med.image_url} alt={med.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xl">💊</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1">
                          <h4 className="font-medium text-gray-900 text-sm leading-tight">{med.name}</h4>
                          {med.requires_prescription && (
                            <Badge variant="warning" className="flex-shrink-0 text-xs px-1.5 py-0.5">
                              Ordo.
                            </Badge>
                          )}
                        </div>
                        {med.description && (
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{med.description}</p>
                        )}
                        <div className="flex items-center justify-between mt-2">
                          <span className="font-semibold text-primary-600 text-sm">{formatPrice(med.price)}</span>
                          <div className="flex items-center gap-2">
                            {med.stock === 0 ? (
                              <span className="text-xs text-red-500 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />Rupture
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">{med.stock} en stock</span>
                            )}
                            <Button
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleAddToCart(med)}
                              disabled={med.stock === 0}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Conflict dialog */}
      <Dialog open={!!conflictMedicine} onOpenChange={() => setConflictMedicine(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Panier différent</DialogTitle>
            <DialogDescription>
              Votre panier contient des articles de <strong>{cart?.pharmacy_name}</strong>.
              Voulez-vous vider le panier et commencer une nouvelle commande ici ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConflictMedicine(null)}>Annuler</Button>
            <Button onClick={handleConfirmSwitch}>Vider et ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
