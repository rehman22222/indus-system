import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { requestNotificationPermission, onForegroundMessage } from '@/lib/firebase';
import { toast } from '@/components/ui/use-toast';

export function useNotifications(userId: string | null) {
    const [fcmToken, setFcmToken] = useState<string | null>(null);

    useEffect(() => {
        if (!userId) return;

        requestNotificationPermission().then(token => {
            if (token) {
                setFcmToken(token);
                // Store FCM token in users table
                supabase
                    .from('users')
                    .update({ fcm_token: token } as any)
                    .eq('id', userId)
                    .then(() => { });
            }
        });

        const unsubscribe = onForegroundMessage((payload) => {
            toast({
                title: payload.notification?.title || 'Notification',
                description: payload.notification?.body || '',
            });
        });

        return () => unsubscribe();
    }, [userId]);

    return { fcmToken };
}
