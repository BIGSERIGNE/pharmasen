import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Upload, MapPin, Store, FileText } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useCart } from '../components/CartContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { formatPrice } from '../lib/utils';
import { cn } from '../lib/utils';
import type { DeliveryType } from '../types';

export default function Checkout() {
  const navigate = useNavigate();
  const { cart, totalPrice, clearCart } = useCart();
  const [delivery, setDelivery] = useState<DeliveryType>('pickup');
  const [address, setAddress] = useState('');
  const [prescriptionFile, setPrescriptionFile] = useState<File | null>(null);
  const [prescriptionNote, setPrescriptionNote] = useState('');
  const [loading, setLoading] = useState(false);

  const requiresPrescription = cart?.items.some((i) => i.medicine.requires_prescription) ?? false;

  if (!cart || cart.items.length === 0) {
    navigate('/cart');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (delivery === 'delivery' && !address.trim()) {
      toast.error("Veuillez saisir l'adresse de livraison");
      return;
    }
    if (requiresPrescription && !prescriptionFile) {
      toast.error('Une ordonnance est requise pour cette commande');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      let prescriptionUrl: string | null = null;

      if (prescriptionFile) {
        const fileName = `prescriptions/${user.id}/${Date.now()}-${prescriptionFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from('orders')
          .upload(fileName, prescriptionFile, { upsert: true });
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('orders').getPublicUrl(fileName);
        prescriptionUrl = urlData.publicUrl;
      }

      const items = cart.items.map((i) => ({
        medicine_id: i.medicine.id,
        medicine_name: i.medicine.name,
        quantity: i.quantity,
        price: i.medicine.price,
      }));

      const { error } = await supabase.from('orders').insert({
        client_id: user.id,
        pharmacy_id: cart.pharmacy_id,
        items,
        total: totalPrice,
        delivery_type: delivery,
        delivery_address: delivery === 'delivery' ? address : null,
        status: 'pending',
        prescription_url: prescriptionUrl,
        prescription_note: prescriptionNote || null,
        prescription_status: requiresPrescription ? 'pending' : 'none',
      });

      if (error) throw error;

      clearCart();
      toast.success('Commande passée avec succès !');
      navigate('/orders');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la commande');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Finaliser la commande</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Delivery type */}
        <div>
          <Label className="text-base font-semibold mb-3 block">Mode de retrait</Label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setDelivery('pickup')}
              className={cn(
                'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all',
                delivery === 'pickup' ? 'border-primary-600 bg-primary-50' : 'border-gray-200'
              )}
            >
              <Store className={cn('h-6 w-6', delivery === 'pickup' ? 'text-primary-600' : 'text-gray-400')} />
              <span className={cn('text-sm font-medium', delivery === 'pickup' ? 'text-primary-700' : 'text-gray-600')}>
                Retrait en pharmacie
              </span>
            </button>
            <button
              type="button"
              onClick={() => setDelivery('delivery')}
              className={cn(
                'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all',
                delivery === 'delivery' ? 'border-primary-600 bg-primary-50' : 'border-gray-200'
              )}
            >
              <MapPin className={cn('h-6 w-6', delivery === 'delivery' ? 'text-primary-600' : 'text-gray-400')} />
              <span className={cn('text-sm font-medium', delivery === 'delivery' ? 'text-primary-700' : 'text-gray-600')}>
                Livraison à domicile
              </span>
            </button>
          </div>
        </div>

        {/* Delivery address */}
        {delivery === 'delivery' && (
          <div className="space-y-1">
            <Label htmlFor="address">Adresse de livraison *</Label>
            <Input
              id="address"
              placeholder="Ex: 45 Rue des Almadies, Dakar"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
            />
          </div>
        )}

        {/* Prescription */}
        <div>
          <Label className="text-base font-semibold mb-1 block flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Ordonnance
            {requiresPrescription && <span className="text-red-500 text-sm font-normal">(obligatoire)</span>}
          </Label>
          {requiresPrescription && (
            <p className="text-sm text-amber-600 bg-amber-50 rounded-lg p-3 mb-3">
              Un ou plusieurs médicaments nécessitent une ordonnance médicale.
            </p>
          )}
          <div
            className={cn(
              'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors',
              prescriptionFile ? 'border-primary-400 bg-primary-50' : 'border-gray-300 hover:border-primary-400'
            )}
            onClick={() => document.getElementById('prescription-upload')?.click()}
          >
            <input
              id="prescription-upload"
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={(e) => setPrescriptionFile(e.target.files?.[0] ?? null)}
            />
            <Upload className={cn('h-8 w-8 mx-auto mb-2', prescriptionFile ? 'text-primary-600' : 'text-gray-400')} />
            {prescriptionFile ? (
              <p className="text-sm font-medium text-primary-700">{prescriptionFile.name}</p>
            ) : (
              <>
                <p className="text-sm font-medium text-gray-700">Cliquez pour uploader une ordonnance</p>
                <p className="text-xs text-gray-400 mt-1">JPG, PNG ou PDF</p>
              </>
            )}
          </div>
          {prescriptionFile && (
            <button
              type="button"
              onClick={() => setPrescriptionFile(null)}
              className="text-sm text-red-500 mt-1 hover:underline"
            >
              Supprimer le fichier
            </button>
          )}
        </div>

        {/* Note */}
        <div className="space-y-1">
          <Label htmlFor="note">Note pour la pharmacie (optionnel)</Label>
          <textarea
            id="note"
            rows={3}
            placeholder="Instructions spéciales, questions..."
            value={prescriptionNote}
            onChange={(e) => setPrescriptionNote(e.target.value)}
            className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 resize-none"
          />
        </div>

        {/* Order summary */}
        <div className="bg-gray-50 rounded-xl p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Résumé ({cart.items.length} article{cart.items.length > 1 ? 's' : ''})</h3>
          <div className="space-y-1.5 mb-3">
            {cart.items.map(({ medicine, quantity }) => (
              <div key={medicine.id} className="flex justify-between text-sm text-gray-600">
                <span>{medicine.name} × {quantity}</span>
                <span>{formatPrice(medicine.price * quantity)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-200 pt-2 flex justify-between font-semibold text-gray-900">
            <span>Total</span>
            <span className="text-primary-600">{formatPrice(totalPrice)}</span>
          </div>
        </div>

        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : 'Confirmer la commande'}
        </Button>
      </form>
    </div>
  );
}
