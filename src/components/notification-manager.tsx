'use client';

import { useEffect, useState } from 'react';
import { useFirebase, useUser } from '@/firebase';
import { getToken, onMessage, Messaging } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { BellRing, BellOff, Loader2 } from 'lucide-react';
import { Button } from './ui/button';

export function NotificationManager() {
    const { messaging, firestore } = useFirebase() as any;
    const { user } = useUser();
    const { toast } = useToast();
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!messaging || !user) return;

        // Check if already subscribed in browser
        if (Notification.permission === 'granted') {
            setIsSubscribed(true);
        }

        const unsubscribe = onMessage(messaging, (payload) => {
            console.log('Foreground Message received: ', payload);
            toast({
                title: payload.notification?.title || 'System Update',
                description: payload.notification?.body || 'New action pending.',
                variant: 'default',
            });
        });

        return () => unsubscribe();
    }, [messaging, user, toast]);

    const requestPermission = async () => {
        if (!messaging || !user || !firestore) return;
        
        setIsLoading(true);
        try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                const token = await getToken(messaging, {
                    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
                });

                if (token) {
                    // Store token in user profile
                    const userRef = doc(firestore, 'users', user.uid);
                    await updateDoc(userRef, {
                        fcmTokens: arrayUnion(token),
                        notificationsEnabled: true
                    });
                    
                    setIsSubscribed(true);
                    toast({
                        title: 'Notifications Enabled',
                        description: 'You will now receive alerts for pending actions in your system tray.',
                        variant: 'success',
                    });
                }
            } else {
                toast({
                    title: 'Permission Denied',
                    description: 'Please enable notifications in browser settings to receive mobile alerts.',
                    variant: 'destructive',
                });
            }
        } catch (error: any) {
            console.error('Notification Error:', error);
            toast({
                title: 'Subscription Failed',
                description: error.message || 'Could not initialize push notifications.',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    if (!messaging) return null;

    return (
        <div className="flex flex-col items-center gap-4 p-6 bg-primary/5 rounded-2xl border border-primary/10">
            <div className="p-3 bg-white rounded-full shadow-sm text-primary">
                {isSubscribed ? <BellRing className="h-6 w-6" /> : <BellOff className="h-6 w-6 opacity-40" />}
            </div>
            <div className="text-center space-y-1">
                <h3 className="text-sm font-bold text-primary">System tray notifications</h3>
                <p className="text-[10px] text-muted-foreground font-normal leading-relaxed max-w-[200px]">
                    Receive instant alerts for pending approvals and critical community actions on your mobile device.
                </p>
            </div>
            <Button 
                onClick={requestPermission} 
                disabled={isSubscribed || isLoading} 
                className="w-full font-bold text-xs h-9 rounded-xl shadow-md transition-transform active:scale-95"
            >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {isSubscribed ? 'Notifications Active' : 'Enable Mobile Alerts'}
            </Button>
        </div>
    );
}
