# 📘 User Guide: /settings/app
    
**Build Version:** `v2026.10.10.1`
**Last Updated:** 10/10/2026
**Internal Route:** `/settings/app`

---

## 🎯 Purpose
App Settings & System Diagnostic Control Panel for configuring organization branding, payment handles, section visibility, and system self-tests.

## 📋 Primary Use Cases
- Configure Organization Name, Registration Number, PAN, Email, Phone, and Address.
- Manage Primary & Backup UPI handles (VPA), Bank Account Details, and IFSC codes.
- Test UPI deep-link generation and scannable QR codes using the **Interactive UPI Link & QR Tester**.
- Configure social media links (Instagram, Facebook, YouTube, Twitter/X, LinkedIn, WhatsApp, Telegram).
- Toggle visibility of home sections (Hero banner, News Ticker, Guiding Principles, Summary cards, Footer components).
- Run cloud diagnostic self-tests for Firestore rules, storage connectivity, and payment gateways.

## 🧪 Interactive UPI Link & QR Tester
- **Mobile Deep-Link Protocol**: Generates `upi://pay?pa=...` links for custom test amounts (₹100) and notes.
- **Desktop Interactive Modal**: When clicking **"Launch UPI App"** on a PC/Mac browser, opens an interactive modal rendering a live scannable QR code (`api.qrserver.com`) so admins can scan and test payments using PhonePe, GPay, Paytm, or BHIM on their mobile phone.
- **Copy URI & Force Launch**: Provides instant clipboard copying and direct protocol triggering.

## 🏗️ Data Architecture (Firestore)
- Collection / Document: `settings/branding`, `settings/payment_gateways`, `settings/app`

## ⌨️ Fields & Data Mapping
- **Organization Identity**: Name, Logo, Registration No., PAN, Email, Phone, Address, Website.
- **Payment & Bank Settings**: Primary VPA Handle, Secondary VPA Handle, Bank Name, Account Name, Account Number, IFSC, SWIFT Code, Payment Mobile Number.
- **Interactive Tester Inputs**: Test Amount (₹), Test Note / Remark.
- **Social Media Profile URLs**: Instagram, Facebook, YouTube, Twitter/X, LinkedIn, WhatsApp, Telegram.

## ⚡ Interactive Action Items
- **Launch UPI App**: Triggers deep-link launch and opens the Interactive QR Tester Modal.
- **Copy URI**: Copies the generated `upi://` URI to clipboard.
- **Run Diagnostics**: Triggers system self-test suite checking database health and storage rules.
- **Commit Sync**: Saves pending configuration changes to Firestore.

## 🛡️ Security & Access
Restricted to Admin users and Staff members with `permissions.settings.app.update` permissions.