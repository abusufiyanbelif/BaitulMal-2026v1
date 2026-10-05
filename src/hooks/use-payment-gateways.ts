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

  const enabledGateways: string[] = [];
  if (gatewaySettings.razorpay?.isEnabled !== false) enabledGateways.push('razorpay');
  if (gatewaySettings.instamojo?.isEnabled) enabledGateways.push('instamojo');
  if (gatewaySettings.phonepe?.isEnabled) enabledGateways.push('phonepe');
  if (gatewaySettings.stripe?.isEnabled) enabledGateways.push('stripe');
  if (gatewaySettings.paytm?.isEnabled) enabledGateways.push('paytm');
  if (gatewaySettings.cashfree?.isEnabled) enabledGateways.push('cashfree');
  if (gatewaySettings.paypal?.isEnabled) enabledGateways.push('paypal');

  const activeGateway = gatewaySettings.activeGateway && gatewaySettings.activeGateway !== 'none'
    ? gatewaySettings.activeGateway
    : (enabledGateways[0] || 'razorpay');

  return {
    gatewaySettings,
    isLoading: user ? isLoading : false,
    error: user ? error : null,
    isMasterEnabled,
    isInternalTest,
    canPublicUseGateway,
    canDonorUseGateway,
    activeGateway,
    enabledGateways,
    allowMultipleGateways: enabledGateways.length > 1,
    isStaff,
  };
}
