# 📱 Messaging Setup Guide — Telegram, WhatsApp & Email

**Version:** v2026.05.07.30  
**Last Updated:** 8 May 2026  
**Applies To:** BaitulMal Samajik Sanstha Solapur

---

## Table of Contents

1. [Overview — Channel Comparison](#1-overview--channel-comparison)
2. [Telegram Setup (Always Free)](#2-telegram-setup-always-free)
3. [WhatsApp Business Setup (Meta Cloud API — Free Tier)](#3-whatsapp-business-setup-meta-cloud-api--free-tier)
4. [WhatsApp via Whapi.cloud (Paid Alternative)](#4-whatsapp-via-whapicloud-paid-alternative)
5. [Email (SMTP) Setup](#5-email-smtp-setup)
6. [Enabling Channels in App Settings](#6-enabling-channels-in-app-settings)
7. [Testing Your Configuration](#7-testing-your-configuration)
8. [User-Level Configuration](#8-user-level-configuration)
9. [Template Architecture](#9-template-architecture)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Overview — Channel Comparison

| Feature | Telegram | WhatsApp (Meta) | WhatsApp (Whapi) | Email |
|---------|----------|-----------------|-------------------|-------|
| **Cost** | 100% Free forever | 1,000 free/month | Paid subscription | Free (with Gmail) |
| **Best For** | Staff alerts, OTP | Donor outreach, OTP | High-volume sending | Receipts, formal |
| **Setup Time** | ~5 minutes | ~30 minutes | ~10 minutes | ~10 minutes |
| **OTP Support** | ✅ | ✅ | ✅ | ❌ |
| **Requires Phone** | No (bot-based) | No (free test number given) | Yes (personal number) | No |
| **API Limit** | Unlimited | 1,000 conversations/month free | Depends on plan | Gmail: 500/day |

### Recommended Strategy
- **Telegram** → Internal staff alerts, admin OTP (always free)
- **WhatsApp Meta** → Donor/Beneficiary OTP and outreach (1,000 free/month)
- **Email** → Formal receipts, password change confirmations

---

## 2. Telegram Setup (Always Free)

### Step 1: Create a Telegram Bot

1. Open **Telegram** on your phone or desktop
2. Search for **@BotFather** (official Telegram bot manager)
3. Send `/newbot` command
4. Enter a **name** for your bot (e.g., `BaitulMal Solapur Alerts`)
5. Enter a **username** ending in `bot` (e.g., `baitulmal_solapur_bot`)
6. **Copy the API token** — it looks like: `7123456789:AAH3kJx8B9xQ2L1K...`

> ⚠️ **Keep this token secret!** Anyone with it can send messages as your bot.

### Step 2: Get Your Group Chat ID

**Option A — For Group Alerts:**
1. Create a new Telegram group (e.g., "BaitulMal Alerts")
2. Add your bot to the group
3. Send any message in the group
4. Open this URL in your browser:
   ```
   https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates
   ```
5. Look for `"chat":{"id":-100XXXXXXXXX}` — the negative number is your **Chat ID**
6. Copy it (e.g., `-1001234567890`)

**Option B — For Individual User Alerts:**
1. Each user opens a chat with your bot and clicks **START**
2. The user's Chat ID is shown in the bot's `getUpdates` response
3. This Chat ID goes into the user's profile in the app

### Step 3: Configure in App

1. Go to **Settings → Resources** in the admin dashboard
2. Click **Edit** (pencil icon)
3. Fill in:
   - **Bot API Token**: `7123456789:AAH3kJx8B9xQ2L1K...`
   - **Target Group Chat ID**: `-1001234567890`
4. Toggle **Enable Telegram Messages** → ON
5. Click **Save**
6. Click **Test Telegram** → You should see a test message in your group

### Step 4: Per-User Telegram (Optional)

For individual OTP delivery, each staff member needs to:
1. Open Telegram → Search for your bot → Click **START**
2. Get their Chat ID from `getUpdates`
3. Admin enters the Chat ID in the user's profile:
   - **Users** → Click user → **Telegram Chat ID** field
   - Or user can set it in their **Profile** page

---

## 3. WhatsApp Business Setup (Meta Cloud API — Free Tier)

> ✅ **Is it free?** Yes! Meta gives you **1,000 free service conversations per month**. OTP and authentication messages are classified as "Authentication" conversations. For an NGO like BaitulMal, this is likely sufficient for all donor/beneficiary OTP needs. **No credit card or paid subscription required.**

### Telegram vs WhatsApp — Side by Side Comparison

| Concept | Telegram | WhatsApp (Meta Free) |
|---------|----------|---------------------|
| **"Account"** | Bot (created via @BotFather) | Meta Developer App (created on Facebook) |
| **"Token/Key"** | Bot Token (`7123456:AAH3kJ...`) | Access Token (`EAAG...`) |
| **"Where to send"** | Chat ID (`-1001234567890`) | Phone Number (`+919876543210`) |
| **"Sender identity"** | Your Bot name | Your WhatsApp Business number |
| **Cost** | 100% free, forever | **1,000 free/month**, then ~₹3-4 per msg |
| **Recipient setup** | Must click START in bot first | Nothing — just needs WhatsApp installed |

### What You Need (3 Credentials — Like Telegram's Token + Chat ID)

| # | Credential | What It Is | Example Value |
|---|-----------|------------|---------------|
| 1 | **Access Token** | Your API key (like Telegram Bot Token) | `EAAGm0PX4ZCps...` (long string) |
| 2 | **Phone Number ID** | ID of your sending number (like Chat ID) | `123456789012345` |
| 3 | **WABA ID** | Your WhatsApp Business Account ID | `987654321098765` |

### Prerequisites
- A Facebook account (personal is fine — no business registration needed)
- No special phone needed (Meta gives you a **free test number** automatically)

---

### Step 1: Create a Meta Developer Account

1. Go to **[developers.facebook.com](https://developers.facebook.com)**
2. Click **"Get Started"** → Log in with your Facebook account
3. Accept the Developer Terms
4. Verify your account (phone/email verification)
5. You'll land on the **Meta Developer Dashboard**

---

### Step 2: Create a New App

1. Click **"My Apps"** (top navigation bar) → **"Create App"**
2. You'll see "What do you want your app to do?" screen:
   - Select **"Other"** → Click **Next**
3. Select app type: **"Business"** → Click **Next**
4. Enter:
   - **App Name**: `BaitulMal Messaging` (or any name you prefer)
   - **Contact Email**: Your email
   - **Business Account**: Select your business or skip if none
5. Click **"Create App"**
6. You'll be taken to the **App Dashboard**

---

### Step 3: Set Up WhatsApp (Use Cases Flow)

> 📍 **Current Portal UI (2025/2026)**: The dashboard shows **"App customization and requirements"** section — NOT the old "Add Products" layout.

On the App Dashboard, you'll see something like this:

```
┌─────────────────────────────────────────────────────────────┐
│  App customization and requirements                         │
│                                                             │
│  ✓  Customize the Connect with customers through            │
│     WhatsApp use case                                   >   │
│                                                             │
│  ○  Test use cases                                      >   │
│                                                             │
│  ○  Check that all requirements are met, then publish   >   │
│     your app                                                │
└─────────────────────────────────────────────────────────────┘
```

1. Click **"Customize the Connect with customers through WhatsApp use case"** (first item, click the `>` arrow)
2. This opens the **WhatsApp API Setup** page

> 💡 **If you DON'T see the WhatsApp use case:**
> - Click **"Add use cases"** button (top right corner of dashboard)
> - Search for **"WhatsApp"**
> - Select **"Connect with customers through WhatsApp"**
> - Click **Confirm** → It will appear on your dashboard

---

### Step 4: Get Your API Credentials

On the **WhatsApp API Setup** page, you'll see all 3 credentials:

```
┌───────────────────────────────────────────────────────────────┐
│  API Setup                                                    │
│                                                               │
│  From:                                                        │
│  ┌────────────────────────────────────────────────────┐       │
│  │ Test Number: +1 555 XXX XXXX                       │       │
│  │ Phone Number ID: 123456789012345             [📋]  │ ← COPY│
│  └────────────────────────────────────────────────────┘       │
│                                                               │
│  WhatsApp Business Account ID: 987654321098765          [📋]  │ ← COPY (WABA ID)
│                                                               │
│  Temporary Access Token:                                      │
│  ┌────────────────────────────────────────────────────┐       │
│  │ EAAGm0PX4ZCps...                            [📋]  │ ← COPY│
│  │                          [Generate new token]      │       │
│  └────────────────────────────────────────────────────┘       │
│  ⚠️ This token expires in 24 hours                            │
└───────────────────────────────────────────────────────────────┘
```

**Copy these 3 values and save them:**
1. ✅ **Phone Number ID** — e.g., `123456789012345`
2. ✅ **WABA ID** (WhatsApp Business Account ID) — e.g., `987654321098765`
3. ✅ **Temporary Access Token** — e.g., `EAAGm0PX4ZCps...` (use for testing only)

> ⚠️ The temporary token expires in **24 hours**. We'll get a permanent one in Step 7.

---

### Step 5: Add Your Phone Number as Test Recipient

Before you can send messages, you must register a test recipient:

1. On the same API Setup page, scroll to the **"To"** section
2. Click **"Manage phone number list"** or **"Add phone number"**
3. Enter your personal WhatsApp number (e.g., `+91 98765 43210`)
4. You'll receive a **verification code on WhatsApp** → Enter it
5. Your number is now whitelisted as a test recipient ✅

> 💡 In **production** (after app review/publishing), you can send to ANY WhatsApp number without whitelisting.

---

### Step 6: Send a Test Message (Verify It Works!)

**From the Meta Portal:**
1. On the API Setup page, select your test recipient from the **"To"** dropdown
2. Click **"Send Message"**
3. You should receive a **"Hello World"** message on your WhatsApp 🎉

**Or test via Terminal/Command Line:**
```bash
curl -X POST "https://graph.facebook.com/v19.0/YOUR_PHONE_NUMBER_ID/messages" \
  -H "Authorization: Bearer YOUR_TEMPORARY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "919876543210",
    "type": "text",
    "text": { "body": "Hello from BaitulMal! Test successful." }
  }'
```

If you get `{"messages":[{"id":"wamid.xxx"}]}` → **It works!** ✅

---

### Step 7: Get a PERMANENT Access Token (Critical for Production!)

The temporary token from Step 4 expires in 24 hours. For production, you need a **permanent (non-expiring) token**:

1. Go to **[business.facebook.com/settings](https://business.facebook.com/settings)**
2. In the left sidebar, click **Users** → **System Users**

> 💡 If "System Users" is not visible, you may need to create a **Business Portfolio** first:
> - Go to [business.facebook.com](https://business.facebook.com)
> - Click **"Create Account"** (if you don't have a business portfolio)
> - Name it `BaitulMal Solapur` → Create

3. Click **"Add"** button to create a new system user
4. Enter:
   - **Name**: `BaitulMal API`
   - **Role**: **Admin**
5. Click **"Create System User"**
6. Click on the created user (`BaitulMal API`)
7. Click **"Assign Assets"**:
   - Go to the **Apps** tab
   - Find your app (`BaitulMal Messaging` or `message test`)
   - Toggle **Full Control** → Click **Save Changes**
8. Go back to the system user → Click **"Generate New Token"**
9. Select your app from the dropdown
10. Check these **permissions** (scroll through the list):
    - ✅ `whatsapp_business_messaging`
    - ✅ `whatsapp_business_management`
11. Set **Token Expiration**: **Never** (if available) or **60 days**
12. Click **"Generate Token"**
13. **🔴 COPY THE TOKEN IMMEDIATELY** — it is shown ONLY ONCE!

> 🔐 Save this token securely (e.g., in a password manager). It looks like:
> `EAAGm0PX4ZCpsBO0a2rZB5K...` (very long string).
> This token does NOT expire and is your permanent API key.

---

### Step 8: (Optional) Use Your Own Phone Number

By default, Meta gives you a **free test phone number**. If you want messages to come from your organization's own number:

1. In Meta Developer Dashboard → Your App → WhatsApp → **API Setup**
2. Click **"Add Phone Number"**
3. Enter your dedicated number (e.g., your org's WhatsApp number)
4. Verify via **SMS** or **Voice Call**
5. You get a new **Phone Number ID** for this number

> ⚠️ **Important**: The number you add CANNOT be currently registered on regular WhatsApp.
> - Use a **new SIM card**, OR
> - Delete the number from regular WhatsApp first:
>   WhatsApp → Settings → Account → Delete Account
> - Then register it here as a Business number

> 💡 **Recommendation**: Start with the **free test number** to verify everything works. Add your own number later.

---

### Step 9: Configure in BaitulMal App

1. Go to **Settings → Resources** in the admin dashboard
2. Click **Edit** (pencil icon)
3. In the WhatsApp section, select **"Meta Official"** provider
4. Enter your credentials:

| Field in App | Value to Enter | Where You Got It |
|-------------|----------------|-----------------|
| **Meta Permanent Access Token** | `EAAGm0PX4ZCps...` | Step 7 (permanent token) |
| **Phone Number ID** | `123456789012345` | Step 4 (or Step 8 if using own number) |
| **WABA ID** | `987654321098765` | Step 4 |

5. Toggle **Auto WhatsApp Messages** → ON
6. Toggle **WhatsApp OTP for Portal Login** → ON
7. Set **Subscription Status** → `Active`
8. Click **Save**

---

### Step 10: Test End-to-End

**Test 1 — From Settings (Connection Test):**
1. Enter a phone number in **"Test WhatsApp Connection"** field (format: `+919876543210`)
2. Click **Send Test**
3. Verify test message received on WhatsApp ✅

**Test 2 — OTP Login Flow:**
1. Go to **Portal Login** page
2. Switch to **OTP** tab
3. Select **WhatsApp** channel (green button)
4. Enter your mobile number or ID → Click **Send OTP**
5. Verify 6-digit OTP received on WhatsApp ✅

**Test 3 — From Template Config:**
1. Go to **Messages → Template Config**
2. Click **Restore Defaults** to seed all templates
3. Select a template (e.g., `otp_donor`)
4. Enter a test phone and click **Send Test**
5. Verify the formatted message received on WhatsApp ✅

---

### How the Message Actually Gets Sent (Technical Flow)

```
User clicks "Send OTP via WhatsApp" on Portal Login
        ↓
App calls sendPortalOTPViaWhatsAppAction()
        ↓
Looks up user's phone number from Firestore
  (checks: users → donors → beneficiaries collections)
        ↓
Generates 6-digit OTP → Stores in portal_otps collection
        ↓
Fetches template (otp_donor / otp_staff / etc.) from Firestore
        ↓
Calls Meta Cloud API:
  POST https://graph.facebook.com/v19.0/{PHONE_NUMBER_ID}/messages
  Headers: Authorization: Bearer {ACCESS_TOKEN}
  Body: { to: "919876543210", text: { body: "Your OTP is 123456" } }
        ↓
Meta delivers to user's WhatsApp → User enters OTP → Verified ✅
```

---

### Cost Summary

| Conversation Type | First 1,000/month | After 1,000 |
|---|---|---|
| **Authentication** (OTP) | ✅ FREE | ~₹3-4 per conversation |
| **Utility** (receipts, alerts) | ✅ FREE | ~₹2-3 per conversation |
| **Marketing** (announcements) | ✅ FREE | ~₹5-7 per conversation |

> 💡 **What counts as 1 conversation?** = One 24-hour window with a user. Multiple messages to the same user within 24 hours = still just 1 conversation. For most NGOs, 1,000 free conversations easily covers all OTP and alert needs.

### FAQ

| Question | Answer |
|----------|--------|
| **Is it really free?** | Yes — 1,000 conversations/month, no credit card needed |
| **Do I need a registered business?** | No — personal Facebook account works for development |
| **Do I need a special phone/SIM?** | No — Meta gives a FREE test number. Your own number is optional |
| **Can I use my personal WhatsApp number?** | Not recommended — it would disconnect from regular WhatsApp |
| **What happens after 1,000?** | Messages fail. You'd need to pay (~₹3-4 per extra conversation) |
| **Can Donors receive without any setup?** | Yes — just needs a WhatsApp account. No bot linking needed |

---

## 4. WhatsApp via Whapi.cloud (Paid Alternative)

> This is a third-party service that connects your regular WhatsApp number (no Meta Business API needed). Useful if you can't set up Meta Business but it costs money.

### Step 1: Create a Whapi.cloud Account

1. Go to [whapi.cloud](https://whapi.cloud)
2. Sign up for an account
3. Choose a plan (starts from ~$15/month)

### Step 2: Connect Your WhatsApp

1. In Whapi dashboard, click **Connect WhatsApp**
2. Scan the QR code with your WhatsApp mobile app
3. Your WhatsApp is now connected to the API

### Step 3: Get API Credentials

1. In Whapi dashboard, go to **API Settings**
2. Copy:
   - **API URL**: `https://gate.whapi.cloud/messages/text`
   - **API Token**: `Bearer your-api-key...`

### Step 4: Configure in App

1. Go to **Settings → Resources**
2. Select **Whapi.cloud** provider
3. Enter:
   - **Whapi API URL**: `https://gate.whapi.cloud/messages/text`
   - **Whapi API Token**: Your token
4. Set Subscription Status to **Active**
5. Save

---

## 5. Email (SMTP) Setup

### Using Gmail SMTP (Free — 500 emails/day)

1. Go to [myaccount.google.com](https://myaccount.google.com) → **Security**
2. Enable **2-Step Verification** if not already done
3. Go to **App Passwords** (search for it in account settings)
4. Generate a new app password for "Mail" + "Other"
5. **Copy the 16-character password**

### Configure in App

1. **Settings → Resources** → Edit
2. Fill in:
   - **SMTP Host**: `smtp.gmail.com`
   - **SMTP Port**: `587`
   - **SMTP Username**: `baitulmalss.solapur@gmail.com`
   - **SMTP Password**: (16-char app password from Step 5)
   - **From Email**: `baitulmalss.solapur@gmail.com`
   - **From Name**: `BaitulMal Alerts`
3. Toggle **Enable Email Alerts** → ON
4. Save → Test with "Test Email" button

---

## 6. Enabling Channels in App Settings

### Global Toggles (Settings → Resources)

| Toggle | Controls | Default |
|--------|----------|---------|
| **Enable Telegram Messages** | All Telegram dispatch (group + individual) | ON |
| **Auto WhatsApp Messages** | All WhatsApp notifications | ON |
| **WhatsApp OTP for Portal Login** | OTP delivery via WhatsApp on login page | OFF |
| **Enable Email Alerts** | All email notifications | ON |

### Module-Specific Toggles (Settings → [Module])

Each module (Campaigns, Leads, Donations, Beneficiaries, Users) has its own notification toggles:
- **Enable Telegram Notifications** → per-module ON/OFF
- **Enable WhatsApp Notifications** → per-module ON/OFF

---

## 7. Testing Your Configuration

### From Settings → Resources

| Channel | Test Method |
|---------|-------------|
| **Telegram** | Click "Test Telegram" → message appears in configured group |
| **WhatsApp** | Enter phone → Click "Send Test" → message on phone |
| **Email** | Enter email → Click "Test Email" → check inbox |

### From User Profile (Admin → Users → Select User)

| Channel | Test Method |
|---------|-------------|
| **Telegram** | Click "Test Connectivity" → sends test to user's Chat ID |
| **WhatsApp** | Click "Test WhatsApp" → sends test to user's phone |

### From Template Config (Messages → Template Config)

1. Select a template
2. Search and select a test user
3. Choose channel tab (Telegram / WhatsApp / Email)
4. Click **Send Test** → message delivered via selected channel

---

## 8. User-Level Configuration

Each user profile (Staff/Donor/Beneficiary) stores:

| Field | Purpose |
|-------|---------|
| `telegramChatId` | Individual Telegram chat ID for 1:1 messages |
| `customTelegramBotToken` | Optional: user's own bot (overrides system bot) |
| `phone` | Mobile number used for WhatsApp delivery |
| `email` | Email address for email delivery |
| `notificationsEnabled` | Master toggle for Telegram |
| `whatsappNotificationsEnabled` | Master toggle for WhatsApp |

---

## 9. Template Architecture

Templates are stored in Firestore at: `settings/message_templates/templates/{templateId}`

### Profile-Based Template Map

| Profile | OTP | Password Change | Welcome | Alerts |
|---------|-----|-----------------|---------|--------|
| **Admin** | otp_admin | password_changed_admin | registration_welcome | admin_login_alert |
| **Member** | otp_staff | password_changed_staff | registration_welcome | member_task_assigned |
| **Donor** | otp_donor | password_changed_donor | registration_welcome | donor_donation_linked, donor_receipt, donor_thank_you |
| **Beneficiary** | otp_beneficiary | password_changed_beneficiary | registration_welcome | beneficiary_disbursement, beneficiary_status_update |
| **General** | — | — | registration_welcome | general_announcement, general_maintenance |

### How to Seed/Reset Templates

1. Go to **Messages → Template Config**
2. Click **Restore Defaults** (shield icon)
3. All 21 default templates will be seeded/updated in Firestore

---

## 10. Troubleshooting

### Telegram

| Error | Cause | Fix |
|-------|-------|-----|
| "Target Chat ID not found" | User hasn't started chat with bot | User must open bot → click START |
| "Unauthorized" | Bot token is invalid/revoked | Create new bot with BotFather |
| "Message simulated" | Token or Chat ID missing | Fill in both fields in Resources |

### WhatsApp (Meta)

| Error | Cause | Fix |
|-------|-------|-----|
| "WhatsApp OTP is not enabled" | Toggle is OFF | Settings → Resources → Enable toggle |
| "Meta API Error: 190" | Access token expired | Generate new permanent token (see Step 7) |
| "Meta API Error: 131030" | Phone number not verified | Verify number in Meta Developer Portal |
| "No phone number linked" | User has no phone in profile | Update user's phone number |
| "Service is Inactive" | Subscription status not set | Set status to "Active" in Resources |
| "Rate limit exceeded" | Over 1,000 conversations/month | Wait for next month or upgrade to paid |

### WhatsApp (Whapi)

| Error | Cause | Fix |
|-------|-------|-----|
| "Whapi Error" | API URL or token wrong | Check credentials in Whapi dashboard |
| Subscription expired | Plan lapsed | Renew on whapi.cloud |

### Email

| Error | Cause | Fix |
|-------|-------|-----|
| "SMTP connection failed" | Wrong host/port | Use `smtp.gmail.com` / `587` |
| "Authentication failed" | Wrong password | Use App Password, not Gmail password |
| "Rate limit exceeded" | Gmail limit (500/day) | Wait 24h or use another SMTP provider |

### General

| Error | Cause | Fix |
|-------|-------|-----|
| "Template not found" | Templates not seeded | Messages → Template Config → Restore Defaults |
| "Message content is empty" | Template body missing or ID wrong | Check template exists in Template Config |
| "Admin SDK initialization failed" | Missing serviceAccountKey.json | Ensure the file exists in project root |

---

*Document maintained by BaitulMal Technical Team. Last updated: v2026.05.07.30*
