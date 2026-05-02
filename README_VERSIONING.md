# 🛡️ Institutional Automation & Documentation Workflow

This document outlines the automated and manual workflows for tracking application builds, documenting system architecture, and generating user guides in the BaitulMal 2026v1 Registry.

## 📁 System Architecture & Automation Tools

| Tool / Script | Purpose |
| :--- | :--- |
| `scripts/publish.js` | **Core Engine**: Handles versioning, release docs, and triggers the full documentation suite. |
| `scripts/generate-index.js` | **Registry Indexer**: Scans all 89+ pages to create a navigational map with redirects. |
| `scripts/generate-user-guides.js` | **Guide Generator**: Creates detailed user manuals with interactive action items. |
| `scripts/generate-architecture.js` | **Architecture Mapper**: Maps Firestore collections to application modules. |
| `src/lib/version.json` | **Version Truth**: The single source of truth for the current application build. |
| `commit-summary.txt` | **Commit Template**: Automated git commit message generated on every publish. |
| `logs/build/` | **Build Archive**: Persistent, versioned logs of every success and failure. |
| `logs/runtime/` | **Operational Trace**: Daily rotating logs of user activity and system errors. |
| `src/lib/logger.ts` | **Logging Core**: Winston-based engine for backend and server error tracking. |
| `src/hooks/use-logger.ts` | **Telemetry Hook**: Client-side hook for component-level event logging. |

## 🤖 Agent Debugging & Build Loops

The system is optimized for iterative fixing. If a build fails:
1.  **Detection**: The `build-wrapper.js` captures the failure and writes it to `build-error.log`.
2.  **Analysis**: The Agent (or Human) should read `build-error.log` to identify the specific error.
3.  **Remediation**: Apply the necessary fix.
4.  **Verification**: Run `npm run build` again. If successful, `build-error.log` is automatically deleted, and the documentation suite is refreshed.

---

## 🤖 Automated Workflows

### 1. Build-Time Documentation (Automatic)
Every time you perform a production build, the documentation suite is automatically refreshed to ensure technical parity.
```powershell
npm run build
```
*Triggers: next build -> generate-index -> generate-user-guides -> generate-architecture*

### 2. The Publish Workflow (Semi-Automatic)
Use this command whenever you finalize a set of changes (Bugs, Enhancements, or Features).
```powershell
npm run publish -- "[Type]" "[Message]" "[Reference]" "[Steps]"
```

**Parameters:**
- **Type**: `Bug`, `Enhancement`, or `Feature`.
- **Message**: A concise description of the change.
- **Reference**: File paths or line ranges (e.g. `src/app/page.tsx`).
- **Steps**: Verification steps for the human/tester to follow.

---

## 🏗️ Technical Documentation Standards

### 📖 Reproducible Steps
To include technical verification steps in the auto-generated **User Guides**, use the following comment pattern in your code:
```typescript
// Step: Navigate to the Donor Dashboard and verify the Pie Chart scaling.
// Step: Click on 'Verified Contributions' to test the scrollable table.
```
The documentation engine will extract these and present them in a dedicated **Reproducible Steps** section in the markdown guide.

### 🏛️ Architecture Mapping
The system automatically tracks Firestore collection usage. Any file that calls `.collection('name')` will be mapped in `docs/architecture/collection-map.md`, showing whether the module has **Read-Only** or **Read/Write** access.

### 📂 Historical Archiving
The system maintains a clear audit trail. When documentation is updated:
1. The previous version is moved to `docs/[module]/history/release-v[PREVIOUS_VERSION]/`.
2. It is renamed with a timestamp to prevent collisions.
3. This ensures that even if a feature is removed or changed, the documentation for that specific build version remains archived.

---

## 🛠️ Maintenance Commands

| Command | Action |
| :--- | :--- |
| `npm run docs:generate` | Refresh all documentation without updating the version number. |
| `npm run publish` | Update version, archive history, and generate release notes. |
| `npm run build` | Compile for production and refresh documentation. |

---
*Maintained by the Institutional Release Automator.*
