# 🛡️ Institutional Versioning & Release Ledger Workflow

This document outlines the automated and manual workflows for tracking application builds, fixes, and feature enhancements in the BaitulMal 2026v1 Registry.

## 📁 System Architecture

| File/Path | Purpose |
| :--- | :--- |
| `scripts/publish.js` | The core engine that handles versioning and document generation. |
| `src/lib/version.json` | The single source of truth for the current application build. |
| `releases/` | Directory containing standalone build-specific release documents. |
| `src/components/app-footer.tsx` | The UI component that displays the live build version. |

---

## 🤖 Automated Agent Workflow (AI/Agent Trigger)

Every time an AI Agent (like Antigravity) completes a modification or fix, it is **required** to execute the versioning script.

### Protocol for Agents:
1.  **Analyze** the changes performed (Bug, Enhancement, or Feature).
2.  **Execute** the script with the appropriate classification.
3.  **Reference** any relevant code blocks or issue IDs.

---

## 🛠️ Manual Workflow (Human Trigger)

If you make manual changes to the codebase without an agent, you should trigger the release documentation manually to keep the ledger accurate.

### Command Syntax:
```powershell
node scripts/publish.js [Type] "[Message]" "[Reference]" "[Steps]"
```

### Parameters:
- **Type**: Must be `Bug`, `Enhancement`, or `Feature`.
- **Message**: A concise description of what was changed.
- **Reference** (Optional): A line range or issue ID (e.g., `#L100-150`).
- **Steps** (Optional): Specific instructions to reproduce or verify the change.

### Example:
```powershell
node scripts/publish.js Bug "Fixed layout shift on mobile profile" "#L405" "1. Login on mobile. 2. Navigate to Profile. 3. Confirm header alignment."
```

---

## 📈 Versioning Format

The system uses a **Chronological Build Sequence**:
`YYYY.MM.DD.BuildNumber`

- **YYYY**: Year (e.g., 2026)
- **MM**: Month (e.g., 05)
- **DD**: Day (e.g., 02)
- **BuildNumber**: Incremental integer starting at `1` each day.

---

## 📄 Release Document Content

Every generated document in `releases/` includes:
- **Build ID**: The atomic version number.
- **Timestamp**: Exact date and time of the build.
- **Git Context**: The repository name, active branch, and specific commit hash.
- **Categorization**: Separation of concerns between fixes and new features.
- **Code Reference**: Direct links or identifiers for the modified lines.

---
*Maintained by the Institutional Release Automator.*
