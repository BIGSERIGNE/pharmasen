import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Package, ChevronDown, ChevronUp, MapPin, Store, FileCheck } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { formatPrice, formatDate, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, PRESCRIPTION_STATUS_LABELS } from '../lib/utils';
import type { Order } from '../types';

async function fetchClientOrders(): Promise<Order[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('orders')
    .select('*, pharmacy:pharmacies(name, address, city, phone)')
    .eq('client_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as Order[];
}

function OrderCard({ order }: { order: Order }) {
  const [expanded, setExpanded] = useState(false);
  const statusClass = ORDER_STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-800';

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center gap-3 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
          <Package className="h-5 w-5 text-primary-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-gray-900 text-sm truncate">
              {(order.pharmacy as unknown as { name: string })?.name ?? 'Pharmacie'}
            </p>
            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${statusClass}`}>
              {ORDER_STATUS_LABELS[order.status]}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{formatDate(order.created_at)}</p>
          <p className="text-sm font-semibold text-primary-600 mt-0.5">{formatPrice(order.total)}</p>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-gray-100 p-4 space-y-4">
          {/* Pharmacy info */}
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              {order.delivery_type === 'delivery' ? (
                <>
                  <MapPin className="h-4 w-4 text-primary-600" />
                  <span>Livraison : {order.delivery_address}</span>
                </>
              ) : (
                <>
                  <Store className="h-4 w-4 text-primary-600" />
                  <span>Retrait en pharmacie</span>
                </>
              )}
            </div>
          </div>

          {/* Items */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Articles</p>
            <div className="space-y-1.5">
              {order.items.map((item) => (
                <div key={item.medicine_id} className="flex justify-between text-sm">
                  <span className="text-gray-700">{item.medicine_name} × {item.quantity}</span>
                  <span className="text-gray-900 font-medium">{formatPrice(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Prescription */}
          {order.prescription_status !== 'none' && (
            <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-3">
              <FileCheck className="h-4 w-4 text-gray-500 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-gray-600">Ordonnance</p>
                <p className={`text-xs ${
                  order.prescription_status === 'approved' ? 'text-green-600' :
                  order.prescription_status === 'rejected' ? 'text-red-600' : 'text-yellow-600'
                }`}>
                  {PRESCRIPTION_STATUS_LABELS[order.prescription_status]}
                </p>
              </div>
              {order.prescription_url && (
                <a
                  href={order.prescription_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto text-xs text-primary-600 hover:underline"
                >
                  Voir
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ClientOrders() {
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['client-orders'],
    queryFn: fetchClientOrders,
  });

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Mes commandes</h1>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl p-4 animate-pulse h-20" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="h-8 w-8 text-gray-400" />
          </div>
          <p className="text-gray-500">Vous n'avez pas encore de commandes</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}
