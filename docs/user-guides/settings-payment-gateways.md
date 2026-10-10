# 📘 User Guide: /settings/payment-gateways
    
**Build Version:** `v2026.10.10.1`
**Last Updated:** 10/10/2026
**Internal Route:** `/settings/payment-gateways`

---

## 🎯 Purpose
Payment Gateways Management Center for configuring, enabling, and testing multi-gateway payment routing (Razorpay, Instamojo, PhonePe, Stripe, Paytm, Cashfree, PayPal).

## 📋 Primary Use Cases
- Enable/disable individual payment gateway providers.
- Configure API Keys, Secrets, Merchant IDs, Webhook Secrets, and Environment Modes (`test` / `live`).
- Set the default primary checkout gateway (e.g. Razorpay).
- Test gateway API connection credentials and verify multi-gateway availability.
- Toggle Master Gateway Switch, Internal Test Mode, Public Direct Donate, and Donor Portal Checkout switches.

## 🧪 Infinite Re-render Loop Fix & Stability Architecture
- Fixed unstable object references in `usePaymentGateways` hook by memoizing default fallback values outside hook context.
- Added `!formData` guard in page `useEffect` to ensure initial form state populates once without infinite re-render loops (`Maximum update depth exceeded`).

## 🏗️ Data Architecture (Firestore)
- Collection / Document: `settings/payment_gateways`

## ⌨️ Fields & Data Mapping
- **Master Switches**: Master Online Gateway Switch, Internal Test Mode, Public Direct Donate, Donor Portal Checkout, Primary Gateway Selector.
- **Razorpay**: Key ID, Key Secret, Webhook Secret, Environment Mode, Enable Toggle.
- **Instamojo**: API Key, Auth Token, Salt, Mode, Enable Toggle.
- **PhonePe**: Merchant ID, Salt Key, Salt Index, Mode, Enable Toggle.
- **Stripe**: Publishable Key, Secret Key, Mode, Enable Toggle.
- **Paytm**: Merchant ID, Merchant Key, Website Name, Mode, Enable Toggle.
- **Cashfree**: App ID, Secret Key, Mode, Enable Toggle.
- **PayPal**: Client ID, Client Secret, Mode, Enable Toggle.

## ⚡ Interactive Action Items
- **Test Connection**: Triggers API key verification handler (`handleTestConnection`) for selected gateway.
- **Save Gateway Settings**: Persists multi-gateway settings to Firestore `settings/payment_gateways` document.

## 🛡️ Security & Access
Restricted strictly to System Admins (`userProfile.role === 'Admin'`).