import { useNavigate } from 'react-router-dom';
import { Minus, Plus, Trash2, ShoppingCart, ArrowRight } from 'lucide-react';
import { useCart } from '../components/CartContext';
import { Button } from '../components/ui/button';
import { formatPrice } from '../lib/utils';

export default function Cart() {
  const navigate = useNavigate();
  const { cart, updateQuantity, removeFromCart, totalItems, totalPrice } = useCart();

  if (!cart || totalItems === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShoppingCart className="h-10 w-10 text-gray-400" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Votre panier est vide</h2>
        <p className="text-gray-500 mb-8">Ajoutez des médicaments depuis une pharmacie pour commencer.</p>
        <Button onClick={() => navigate('/home')}>Parcourir les pharmacies</Button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Mon panier</h1>
      <p className="text-sm text-gray-500 mb-6">{cart.pharmacy_name}</p>

      <div className="space-y-3 mb-6">
        {cart.items.map(({ medicine, quantity }) => (
          <div key={medicine.id} className="bg-white rounded-xl border border-gray-100 p-4 flex gap-3 shadow-sm">
            <div className="w-14 h-14 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {medicine.image_url ? (
                <img src={medicine.image_url} alt={medicine.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl">💊</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-gray-900 text-sm">{medicine.name}</h3>
              <p className="text-primary-600 font-semibold text-sm mt-0.5">{formatPrice(medicine.price)}</p>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    onClick={() => updateQuantity(medicine.id, quantity - 1)}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="text-sm font-semibold w-6 text-center">{quantity}</span>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    onClick={() => updateQuantity(medicine.id, quantity + 1)}
                    disabled={quantity >= medicine.stock}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-700">{formatPrice(medicine.price * quantity)}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
                    onClick={() => removeFromCart(medicine.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm mb-6">
        <h3 className="font-semibold text-gray-900 mb-3">Résumé</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Sous-total ({totalItems} article{totalItems > 1 ? 's' : ''})</span>
            <span>{formatPrice(totalPrice)}</span>
          </div>
          <div className="border-t border-gray-100 pt-2 flex justify-between font-semibold text-gray-900">
            <span>Total</span>
            <span className="text-primary-600">{formatPrice(totalPrice)}</span>
          </div>
        </div>
      </div>

      <Button className="w-full gap-2" size="lg" onClick={() => navigate('/checkout')}>
        Passer la commande <ArrowRight className="h-5 w-5" />
      </Button>
    </div>
  );
}
