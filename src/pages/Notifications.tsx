import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Package, Info, Check } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Button } from '../components/ui/button';
import { formatDate } from '../lib/utils';
import { cn } from '../lib/utils';
import type { Notification, NotificationType } from '../types';

async function fetchNotifications(): Promise<Notification[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('recipient_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

function NotifIcon({ type }: { type: NotificationType }) {
  if (type === 'order_update') return <Package className="h-5 w-5 text-primary-600" />;
  if (type === 'prescription_update') return <Bell className="h-5 w-5 text-amber-500" />;
  return <Info className="h-5 w-5 text-blue-500" />;
}

export default function Notifications() {
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('recipient_id', user.id)
        .eq('is_read', false);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  // Realtime subscription
  useEffect(() => {
    const sub = supabase
      .channel('notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => {
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [queryClient]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-gray-500 mt-0.5">{unreadCount} non lue{unreadCount > 1 ? 's' : ''}</p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
          >
            <Check className="h-3.5 w-3.5" />
            Tout marquer lu
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl p-4 animate-pulse h-20" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Bell className="h-8 w-8 text-gray-400" />
          </div>
          <p className="text-gray-500">Aucune notification</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => !notif.is_read && markRead.mutate(notif.id)}
              className={cn(
                'bg-white rounded-xl border p-4 flex gap-3 cursor-pointer transition-all hover:shadow-sm',
                notif.is_read ? 'border-gray-100 opacity-75' : 'border-primary-200 bg-primary-50/30'
              )}
            >
              <div className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                notif.is_read ? 'bg-gray-100' : 'bg-white shadow-sm'
              )}>
                <NotifIcon type={notif.type} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className={cn('text-sm font-semibold', notif.is_read ? 'text-gray-600' : 'text-gray-900')}>
                    {notif.title}
                  </p>
                  {!notif.is_read && (
                    <div className="w-2 h-2 bg-primary-600 rounded-full flex-shrink-0 mt-1" />
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{notif.message}</p>
                <p className="text-xs text-gray-400 mt-1">{formatDate(notif.created_at)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
