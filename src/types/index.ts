export type UserRole = 'client' | 'pharmacist' | 'admin';

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  pharmacy_id: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Pharmacy {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  email: string | null;
  image_url: string | null;
  is_active: boolean;
  opening_hours: string | null;
  created_at: string;
}

export interface Medicine {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  price: number;
  stock: number;
  pharmacy_id: string;
  image_url: string | null;
  requires_prescription: boolean;
  is_active: boolean;
  created_at: string;
}

export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
export type DeliveryType = 'pickup' | 'delivery';
export type PrescriptionStatus = 'none' | 'pending' | 'approved' | 'rejected';

export interface OrderItem {
  medicine_id: string;
  medicine_name: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  client_id: string;
  pharmacy_id: string;
  items: OrderItem[];
  total: number;
  delivery_type: DeliveryType;
  delivery_address: string | null;
  status: OrderStatus;
  prescription_url: string | null;
  prescription_note: string | null;
  prescription_status: PrescriptionStatus;
  created_at: string;
  pharmacy?: Pharmacy;
  profile?: Profile;
}

export type NotificationType = 'order_update' | 'prescription_update' | 'info';

export interface Notification {
  id: string;
  recipient_id: string;
  title: string;
  message: string;
  type: NotificationType;
  order_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  pharmacy_id: string;
  created_at: string;
}

export interface CartItem {
  medicine: Medicine;
  quantity: number;
}

export interface Cart {
  pharmacy_id: string;
  pharmacy_name: string;
  items: CartItem[];
}
