'use client';

import { useMemo } from 'react';
import { useMemoFirebase, useFirestore, useDoc, doc, type DocumentReference } from '@/firebase';
import type { PaymentGatewaySettings } from '@/lib/types';
import { useSession } from '@/hooks/use-session';

const DEFAULT_GATEWAY_SETTINGS: PaymentGatewaySettings = {
  isOnlineGatewayEnabled: true,
  isPublicGatewayEnabled: true,
  isDonorGatewayEnabled: true,
  isInternalTestMode: false,
  activeGateway: 'none',
};

export function usePaymentGateways() {
  const firestore = useFirestore();
  const { user, userProfile } = useSession();

  const docRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'settings', 'payment_gateways') as DocumentReference<PaymentGatewaySettings>;
  }, [firestore, user]);

  const { data: rawSettings, isLoading, error } = useDoc<PaymentGatewaySettings>(docRef);

  const gatewaySettings: PaymentGatewaySettings = rawSettings || DEFAULT_GATEWAY_SETTINGS;

  const isStaff = userProfile?.role === 'Admin' || userProfile?.role === 'User' || userProfile?.role === 'Staff' || userProfile?.role === 'Member';

  const isMasterEnabled = gatewaySettings.isOnlineGatewayEnabled !== false;
  const isInternalTest = gatewaySettings.isInternalTestMode === true;
  
  const canPublicUseGateway = isMasterEnabled && (gatewaySettings.isPublicGatewayEnabled !== false) && (!isInternalTest || isStaff);
  const canDonorUseGateway = isMasterEnabled && (gatewaySettings.isDonorGatewayEnabled !== false) && (!isInternalTest || isStaff);

  const enabledGateways = useMemo(() => {
    const list: string[] = [];
    if (gatewaySettings.razorpay?.isEnabled !== false) list.push('razorpay');
    if (gatewaySettings.instamojo?.isEnabled) list.push('instamojo');
    if (gatewaySettings.phonepe?.isEnabled) list.push('phonepe');
    if (gatewaySettings.stripe?.isEnabled) list.push('stripe');
    if (gatewaySettings.paytm?.isEnabled) list.push('paytm');
    if (gatewaySettings.cashfree?.isEnabled) list.push('cashfree');
    if (gatewaySettings.paypal?.isEnabled) list.push('paypal');
    return list;
  }, [
    gatewaySettings.razorpay?.isEnabled,
    gatewaySettings.instamojo?.isEnabled,
    gatewaySettings.phonepe?.isEnabled,
    gatewaySettings.stripe?.isEnabled,
    gatewaySettings.paytm?.isEnabled,
    gatewaySettings.cashfree?.isEnabled,
    gatewaySettings.paypal?.isEnabled,
  ]);

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
