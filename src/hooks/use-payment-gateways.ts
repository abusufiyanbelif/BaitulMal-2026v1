'use client';

import { useMemoFirebase, useFirestore, useDoc, doc, type DocumentReference } from '@/firebase';
import type { PaymentGatewaySettings } from '@/lib/types';
import { useSession } from '@/hooks/use-session';

export function usePaymentGateways() {
  const firestore = useFirestore();
  const { user, userProfile } = useSession();

  const docRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'settings', 'payment_gateways') as DocumentReference<PaymentGatewaySettings>;
  }, [firestore, user]);

  const { data: rawSettings, isLoading, error } = useDoc<PaymentGatewaySettings>(docRef);

  const gatewaySettings: PaymentGatewaySettings = rawSettings || {
    isOnlineGatewayEnabled: true,
    isPublicGatewayEnabled: true,
    isDonorGatewayEnabled: true,
    isInternalTestMode: false,
    activeGateway: 'none',
  };

  const isStaff = userProfile?.role === 'Admin' || userProfile?.role === 'User' || userProfile?.role === 'Staff' || userProfile?.role === 'Member';

  const isMasterEnabled = gatewaySettings.isOnlineGatewayEnabled !== false;
  const isInternalTest = gatewaySettings.isInternalTestMode === true;
  
  const canPublicUseGateway = isMasterEnabled && (gatewaySettings.isPublicGatewayEnabled !== false) && (!isInternalTest || isStaff);
  const canDonorUseGateway = isMasterEnabled && (gatewaySettings.isDonorGatewayEnabled !== false) && (!isInternalTest || isStaff);

  const activeGateway = gatewaySettings.activeGateway || 'none';

  return {
    gatewaySettings,
    isLoading: user ? isLoading : false,
    error: user ? error : null,
    isMasterEnabled,
    isInternalTest,
    canPublicUseGateway,
    canDonorUseGateway,
    activeGateway,
    isStaff,
  };
}
