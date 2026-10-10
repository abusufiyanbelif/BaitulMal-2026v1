# 📘 User Guide: /settings/guidance
    
**Build Version:** `v2026.10.10.1`
**Last Updated:** 10/10/2026
**Internal Route:** `/settings/guidance`

---

## 🎯 Purpose
Guidance & Schemes Settings module for configuring public visibility, directory branding, page headlines, and introductory descriptions for the Help & Guidance directory.

## 📋 Primary Use Cases
- Toggle public directory availability for anonymous visitors.
- Edit page headline title and introduction text.
- Preview the public guidance page ([`/info/guidance`](/info/guidance)).
- Access the admin Guidance Management Hub ([`/guidance`](/guidance)).

## 🧪 Default Fallback State & Section Collapse Architecture
- Fixed empty page initialization when Firestore `settings/guidance` document is null by initializing automatic default state (`{ title: 'Help Guides & Official Schemes Directory', description: '...', categories: [], isPublic: true }`).
- Wrapped controls in default-collapsed `SettingsSection` components for clutter reduction.

## 🏗️ Data Architecture (Firestore)
- Collection / Document: `settings/guidance`

## ⌨️ Fields & Data Mapping
- **Module Visibility**: Public Access Toggle (`isPublic`).
- **Directory Branding**: Page Headline Title (`title`), Directory Description (`description`).

## ⚡ Interactive Action Items
- **Edit Config**: Enables input fields and textareas for editing.
- **Save Config**: Saves guidance branding settings to Firestore `settings/guidance`.
- **Preview public page**: Opens public guidance directory in new tab.
- **Go To Guidance Hub**: Navigates to admin resource/scheme management workspace.

## 🛡️ Security & Access
Restricted to Admin users and Staff with `permissions.settings.guidance.update` permissions.