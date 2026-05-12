import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { CartProvider } from './components/CartContext';
import Layout from './components/layout/Layout';

import Landing from './pages/Landing';
import Auth from './pages/Auth';
import Home from './pages/Home';
import AdminDashboard from './pages/AdminDashboard';
import ProtectedAdminRoute from './components/ProtectedAdminRoute';
import PharmacyDetail from './pages/PharmacyDetail';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import ClientOrders from './pages/ClientOrders';
import PharmaDashboard from './pages/PharmaDashboard';
import PharmaStock from './pages/PharmaStock';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CartProvider>
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />

            {/* Client routes */}
            <Route element={<Layout requiredRole="client" />}>
              <Route path="/home" element={<Home />} />
              <Route path="/pharmacy/:id" element={<PharmacyDetail />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/orders" element={<ClientOrders />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/profile" element={<Profile />} />
            </Route>

            {/* Pharmacist routes */}
            <Route element={<Layout requiredRole="pharmacist" />}>
              <Route path="/pharma/dashboard" element={<PharmaDashboard />} />
              <Route path="/pharma/stock" element={<PharmaStock />} />
              <Route path="/pharma/notifications" element={<Notifications />} />
              <Route path="/pharma/profile" element={<Profile />} />
            </Route>

            {/* Admin routes */}
            <Route element={<ProtectedAdminRoute />}>
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-center" richColors />
      </CartProvider>
    </QueryClientProvider>
  );
}
