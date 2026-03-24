# Dnyani Mitra — Project Plan & Requirements

> This is the living project document. Every iteration must read this before starting work.
> Every completed iteration must update the status here before finishing.
> **Never delete completed items** — mark them with status and date.

---

## Table of Contents

1. [Project Vision](#1-project-vision)
2. [Current State](#2-current-state)
3. [Iteration History](#3-iteration-history)
4. [Data Sync — Detailed Requirements](#4-data-sync--detailed-requirements)
5. [Multi-Perspective Review Findings](#5-multi-perspective-review-findings)
6. [Enhancement Roadmap](#6-enhancement-roadmap)
7. [Known Issues Registry](#7-known-issues-registry)
8. [Architecture Decisions](#8-architecture-decisions)
9. [Resumption Guide](#9-resumption-guide)

---

## 1. Project Vision

**App Name:** Dnyani Mitra (NGO Visitor & Reminder Manager)
**Organization:** Sewa Sankalp Pratishthan
**Goal:** Evolve from a single-NGO offline tool into a global daily helper for NGOs to maintain their network of well-wishers, donors, beneficiaries, and volunteers.

**Target Users:**
- NGO coordinators (Root machine at office/HQ)
- Field volunteers (Satellite machines on personal Android phones)
- The app must work on cheap Android phones (MI, Xiaomi, Oppo, Realme) with spotty internet

**Core Principle:** Offline-first. No server required. Sync via JSON files shared over WhatsApp/email/USB.

---

## 2. Current State

**Version:** 2.0.0
**Tech Stack:** Vanilla JS (ES6 modules), vanilla CSS, Vite, Capacitor (Android)
**Last Updated:** 2026-03-24

### What Works Today
- Activation with master key (root/satellite machine setup)
- Visitor CRUD (create, view, edit, soft-delete)
- Multi-contact per visitor (SELF + family members with phones, emails, dates)
- Reminder dashboard (birthdays, anniversaries, death anniversaries)
- Reminder actions (snooze, contacted, completed)
- Interaction logging (call, visit, email, letter)
- JSON export/import with basic merge
- Android APK build via GitHub Actions
- Single-file build (works from file:// protocol)

### What's Broken / Fixed (as of 2026-03-20)
| Issue | Status | Details |
|-------|--------|---------|
| APK crashes on MI/Chinese phones | FIXED | Missing colors.xml, network_security_config.xml, overly permissive file_paths.xml |
| Import backup.json fails | FIXED | Wrong event name (DATA_CHANGED→IMPORT_COMPLETED), no BOM handling, reload race condition |
| VisitorForm crash on corrupted data | FIXED | Unguarded SELF contact .find() in phone/email add/remove |
| Invalid dates show "NaN days ago" | FIXED | Added isNaN checks in formatters.js |
| Sync uses ID-only matching (no phone dedup) | FIXED | Two-tier merge: ID + phone-based dedup with name similarity check |
| "Include Interaction History" checkbox not wired | FIXED | Export now uses SyncService.prepareExport() with checkbox value |
| Satellite import warning is misleading | FIXED | Replaced with role-aware guidance text for Root and Satellite |
| "Sycing" typo in sync UI | FIXED | Removed along with misleading warning text |
| No pre-sync backup | FIXED | Auto-backup before every import + restore UI |
| SyncManager bypasses SyncService.prepareExport | FIXED | Export now uses SyncService.prepareExport() |

---

## 3. Iteration History

### Iteration 1 — Bug Fixes & Codebase Review (2026-03-20)
**Status:** COMPLETE — ready to commit
**Scope:** Fix two critical production bugs + comprehensive codebase review

**Files Changed:**
| File | Change |
|------|--------|
| `android/app/src/main/res/values/colors.xml` | NEW — defines colorPrimary/Dark/Accent for styles.xml |
| `android/app/src/main/res/xml/network_security_config.xml` | NEW — MIUI requires explicit network trust config |
| `android/app/src/main/AndroidManifest.xml` | Added networkSecurityConfig reference |
| `android/app/src/main/java/.../MainActivity.java` | Added onPause lifecycle, explicit DOM storage path, MIUI file access flags |
| `android/app/src/main/res/xml/file_paths.xml` | Removed dangerous root-path, restricted to app dirs + Downloads |
| `android/app/proguard-rules.pro` | Added keep rules for Capacitor bridge + WebView classes |
| `src/services/SyncService.js` | Fixed event name, added validation, soft-delete awareness, interaction validation |
| `src/components/Sync/SyncManager.js` | Added BOM handling, reload delay, skipped count display |
| `src/components/Visitors/VisitorForm.js` | Guarded SELF contact access with null checks |
| `src/utils/formatters.js` | Invalid date handling in formatRelativeTime, getDaysUntil, normalizeEventDate |

**Review Findings:** See Sections 5, 6, 7

---

### Iteration 2 — Data Sync Redesign + Production Hardening (2026-03-24)
**Status:** COMPLETE — committed and pushed
**Scope:** Phone-based deduplication, two-tier merge, pre-sync backup, UI fixes, Android production readiness

**Detailed requirements:** See Section 4
**Detailed implementation plan:** See ITERATION_2_PLAN.md

**Part A — Sync Redesign Files:**
| File | Change |
|------|--------|
| `src/utils/formatters.js` | Added `normalizePhone()` (strip non-digits, last 10) and `namesSimilar()` (exact/contains/first-word match) |
| `src/utils/constants.js` | Added `PRE_SYNC_BACKUP` to STORAGE_KEYS |
| `src/services/SyncService.js` | Rewrote `merge()` with two-tier algorithm (ID + phone), `visitorIdRemap` for interaction orphan prevention, `createBackup()`/`restoreBackup()`/`getBackupInfo()` with QuotaExceeded handling, `prepareExport()` with `includeInteractions` option |
| `src/components/Sync/SyncManager.js` | Wired export checkbox via SyncService.prepareExport(), replaced satellite warning with role-aware text, `minmax(min(400px,100%),1fr)` for mobile, enhanced import results with phone-match/duplicate/backup status, added restore-from-backup section |

**Part B — Android Production Hardening Files:**
| File | Change |
|------|--------|
| `android/app/src/main/AndroidManifest.xml` | Added `fullBackupContent`, `dataExtractionRules`, `extractNativeLibs` for Play Store compliance and Oppo/Realme install compat |
| `android/app/src/main/java/.../MainActivity.java` | Added `onBackPressed()` for MIUI/ColorOS hardware back button |
| `android/app/build.gradle` | Version from variables.gradle, signing config from keystore.properties, `minifyEnabled true`, `shrinkResources true` |
| `android/variables.gradle` | Added `appVersionCode=1`, `appVersionName='2.0.0'` |
| `android/app/proguard-rules.pro` | Added Cordova, `@JavascriptInterface`, FileProvider, annotation keep rules, `-dontwarn` |
| `android/app/src/main/res/xml/data_extraction_rules.xml` | NEW — Android 12+ backup/transfer rules (targetSdk 31+ requirement) |
| `android/app/src/main/res/xml/backup_rules.xml` | NEW — Android 6-11 Auto Backup rules |
| `android/.gitignore` | Enabled keystore/jks/keystore.properties exclusion |

**Part C — Documentation:**
| File | Change |
|------|--------|
| `PROJECT_PLAN.md` | Updated iteration status, roadmap checkboxes, current state table |
| `CLAUDE.md` | Fixed Java version 17→21, added assembleRelease command |
| `ITERATION_2_PLAN.md` | NEW — Full implementation plan with business/technical/architectural review |

**Review findings applied during implementation:**
- Fixed interaction orphaning on phone-merge (visitorIdRemap)
- Fixed grid layout overflow on phones < 400px (min() CSS function)
- Fixed createBackup() QuotaExceededError crash
- Added backup failure warning in import results

---

## 4. Data Sync — Detailed Requirements

### 4.1 Real-World Sync Flow

**The People:**
- 1 Root machine (NGO coordinator at office)
- Multiple Satellite machines (field volunteers with Android phones)

**Weekly Cycle:**
```
Monday:    Coordinator adds new contacts, exports master list
           Shares JSON via WhatsApp group to all volunteers

Tue-Wed:   Volunteers import coordinator's file → get latest contacts
           Volunteers visit contacts, log interactions, update info, add new contacts

Thursday:  Each volunteer exports their data, sends to coordinator
           Coordinator imports each volunteer's file → gets field updates

Friday:    Coordinator exports updated master list
           All volunteers import → full sync complete
```

### 4.2 Sync Directions

| Direction | Purpose | Frequency |
|-----------|---------|-----------|
| Root → Satellite | Distribute latest contact list to volunteers | Weekly or on major updates |
| Satellite → Root | Push field data (new contacts, interactions, updates) to HQ | After each field session |
| Satellite → Satellite | Peer sharing when volunteers cover overlapping areas | As needed |

**All directions use the same export/import mechanism. No direction is blocked.**

### 4.3 Visitor Identity & Deduplication

**A visitor is uniquely identified using a two-tier matching system:**

**Tier 1 — Visitor ID (primary, handles 95% of cases)**
- All visitors originating from Root get a unique `visitor_xxx` ID
- When satellites import from Root, they get these IDs
- When satellites export back to Root, the IDs match → correct update

**Tier 2 — Phone Number (secondary, catches independent creation)**
- When two machines independently create the same person, they get different IDs
- Phone number of the SELF contact's first phone is used as a natural key
- Only activated when Tier 1 (ID match) fails

**Phone Normalization:**
```
"+91 98765-43210"  →  strip non-digits  →  "919876543210"  →  last 10  →  "9876543210"
"098765 43210"     →  strip non-digits  →  "09876543210"   →  last 10  →  "9876543210"
"9876543210"       →  strip non-digits  →  "9876543210"    →  last 10  →  "9876543210"
"12345" (< 10)     →  use as-is (too short for reliable matching)
```

**Phone Match Safety Rules:**
- Empty/missing phones → never match by phone
- Phones with fewer than 10 digits → skip phone matching
- Phone match + similar names → auto-merge (same person, spelling variation)
- Phone match + different names → add as new, flag as potential duplicate (could be husband/wife sharing phone)

**Name Similarity Check:**
```
namesSimilar(name1, name2):
  n1 = lowercase, trimmed
  n2 = lowercase, trimmed

  Exact match → true
  One contains the other → true  (e.g., "Suresh" vs "Suresh Patil")
  First word matches → true     (e.g., "Suresh R." vs "Suresh Kumar")
  Otherwise → false
```

### 4.4 Merge Algorithm

```
MERGE(incomingPackage):

  Step 0: AUTO-BACKUP
    Save current state to localStorage key "NGOApp_v2_PreSyncBackup"

  Step 1: BUILD LOOKUP INDEXES
    localIdMap    = Map<visitorId, visitor>     from local state
    localPhoneMap = Map<normalizedPhone, visitorId>  from local SELF contacts' first phone

  Step 2: PROCESS EACH INCOMING VISITOR
    FOR each incoming visitor:

      // Validate
      IF missing id OR missing contacts array → skip

      // Extract incoming primary phone
      incomingSelf  = incoming.contacts.find(relationType === 'SELF')
      incomingPhone = normalize(incomingSelf?.phones?.[0])

      // Tier 1: Match by visitor ID
      IF localIdMap.has(incoming.id):
        existing = localIdMap.get(incoming.id)
        IF existing.status === 'deleted' AND incoming.status !== 'deleted':
          IF existing.deletedAt > incoming.updatedAt → skip (local delete is newer)
        IF incoming.updatedAt > existing.updatedAt:
          Replace existing with incoming (keep local ID)
          → UPDATED
        CONTINUE

      // Tier 2: Match by phone
      IF incomingPhone AND length >= 10 AND localPhoneMap.has(incomingPhone):
        existingId   = localPhoneMap.get(incomingPhone)
        existing     = localIdMap.get(existingId)
        existingSelf = existing.contacts.find(relationType === 'SELF')

        IF namesSimilar(incomingSelf.name, existingSelf.name):
          // Same person, different IDs — merge
          IF incoming.updatedAt > existing.updatedAt:
            Update existing with incoming data (KEEP existing's local ID)
            → UPDATED (PHONE MATCH)
          CONTINUE
        ELSE:
          // Same phone, different names — potential duplicate
          → FLAG AS DUPLICATE (add to duplicateFlags list)
          // Still add as new visitor — user can review later

      // Tier 3: No match — add as new
      → ADDED

  Step 3: MERGE INTERACTIONS
    Deduplicate by interaction ID
    Validate: must have id, visitorId, interactionType
    Append new interactions

  Step 4: MERGE REMINDER ACTIONS
    Deduplicate by action ID
    Append new actions

  Step 5: SAVE STATE + EMIT EVENTS

  Step 6: RETURN RESULTS
    { added, updated, updatedByPhone, skipped, duplicateFlags[], interactionsAdded }
```

### 4.5 Conflict Resolution Rules

| Situation | Rule | Rationale |
|-----------|------|-----------|
| Same ID, incoming newer | Incoming wins | Latest edit is most accurate |
| Same ID, local newer | Local stays | Don't overwrite newer data |
| Same phone, similar name, incoming newer | Incoming wins (merge into local ID) | Same person, deduplicated |
| Same phone, different name | Add as new, flag duplicate | Could be family sharing phone |
| Visitor deleted locally, incoming is active but older | Stay deleted | Respect intentional deletion |
| Visitor deleted locally, incoming is active and newer | Incoming wins (restore) | Deletion was overridden by newer edit |
| New visitor, no match | Add | Fresh contact |
| Empty phone on both sides | Never match by phone | Too unreliable |

### 4.6 What Gets Synced

| Data | Exported | Imported | Merge Strategy |
|------|----------|----------|----------------|
| Visitors (with contacts) | Always | Always | ID → phone → add new |
| Interactions | Optional (checkbox) | If present | Deduplicate by ID, append |
| Reminder Actions | No | No | Local preference only |
| Settings | No | No | Local preference only |

### 4.7 UI Changes Required

**Export section:**
- Wire "Include Interaction History" checkbox to actual export logic
- Role-aware guidance text:
  - Root: "Export your master contact list for volunteers to import"
  - Satellite: "Export your field data for the coordinator to import"

**Import section:**
- Remove misleading satellite warning (line 67-71)
- Replace with helpful text:
  - Root: "Import field data from volunteer devices"
  - Satellite: "Import the latest contacts from coordinator"
- Fix "Sycing" typo → "Syncing"
- Enhanced preview: show breakdown (X new, Y updates, Z flagged duplicates)
- Show: "Your current data has been backed up automatically"
- If duplicates flagged: show warning with names/phones for user review

**New: Restore section:**
- "Restore from last backup" button
- Only visible if `NGOApp_v2_PreSyncBackup` exists in localStorage
- Shows when backup was created

### 4.8 Existing Sync Bugs to Fix

| # | Bug | Location | Status |
|---|-----|----------|--------|
| 1 | "Include Interaction History" checkbox not connected | SyncManager.js | FIXED — export uses SyncService.prepareExport({ includeInteractions }) |
| 2 | "Sycing" typo | SyncManager.js | FIXED — removed with old warning text |
| 3 | Satellite warning discourages valid import | SyncManager.js | FIXED — replaced with role-aware guidance |
| 4 | SyncService.prepareExport() never used | SyncService.js | FIXED — SyncManager now uses it |
| 5 | No pre-sync backup | SyncService.js | FIXED — auto-backup in merge(), restore UI added |
| 6 | Import preview lacks detail | SyncManager.js | FIXED — shows phone-match, duplicate flags, backup info |
| 7 | SyncManager builds own export instead of using SyncService | SyncManager.js | FIXED — consolidated into SyncService.prepareExport() |

---

## 5. Multi-Perspective Review Findings

> Conducted 2026-03-20. Reviewed from 11 stakeholder perspectives.

### 5.1 Critical Gaps by Stakeholder

| Perspective | Top Gap | Priority |
|-------------|---------|----------|
| **NGO Owner** | No dashboard/reports for board meetings | Phase 2 |
| **Field Worker** | Form too complex (3 steps, triple-dropdown dates) | Phase 2 |
| **Visitor/Beneficiary** | No GDPR consent, no opt-out | Phase 2 |
| **Donor** | No donation tracking model | Phase 3 |
| **CSR Lead** | No audit trail, no compliance reports | Phase 3 |
| **Family/Friend** | No household-level communication preferences | Phase 3 |
| **Technical** | No tests, memory leaks, no error boundaries | Phase 2 |
| **Solution Architect** | localStorage 5MB limit (~5k visitors max) | Phase 3 |
| **UX/UI Expert** | No empty states, no loading states, no a11y | Phase 2 |
| **App Designer** | No onboarding tour, no undo, generic errors | Phase 2 |
| **App Developer** | Monolithic components, no lifecycle cleanup | Phase 2 |

### 5.2 Quick Wins Identified

| Fix | Effort | Impact |
|-----|--------|--------|
| Add empty state UI | 1 hour | High |
| Add loading spinners | 2 hours | High |
| Add confirm dialogs for delete | 1 hour | High |
| Use native date input | 3 hours | Medium |
| Add GDPR consent checkbox | 2 hours | High |
| Add error boundaries | 4 hours | High |

---

## 6. Enhancement Roadmap

### Phase 1 — Sync Redesign (Iteration 2, DONE)
- [x] Phone normalization utility
- [x] Two-tier merge algorithm (ID + phone)
- [x] Name similarity check
- [x] Pre-sync auto-backup + restore
- [x] Wire "Include Interaction History" checkbox
- [x] Fix satellite warning text
- [x] Enhanced import preview with breakdown
- [x] Duplicate flagging in import summary

### Phase 2 — Foundation & UX (Iterations 3-5)
- [ ] Settings UI (reminder lookahead, preferences)
- [ ] GDPR consent mechanism on visitor creation
- [ ] Empty states, loading states, error boundaries
- [ ] Native date inputs (replace triple-dropdown)
- [ ] Confirm dialogs for destructive actions (delete visitor)
- [ ] Dashboard with growth charts and activity metrics
- [ ] CSV/PDF report export
- [ ] Onboarding tour for first-time users

### Phase 3 — Leadership & Compliance (Iterations 6-8)
- [ ] Donation/contribution data model
- [ ] Audit trail (who changed what, when)
- [ ] Role-based access control
- [ ] Multi-branch/chapter support
- [ ] Internationalization (i18n) readiness

### Phase 4 — Scale & Integration (Iterations 9+)
- [ ] Backend API for real-time sync
- [ ] PWA service worker for offline install
- [ ] Search indexing for 10k+ visitors
- [ ] Multi-tenancy / SaaS readiness

---

## 7. Known Issues Registry

> Issues that exist but are deferred. Each entry explains why it's OK for now.

### 7.1 CSS Hardcoded Colors (Deferred)
- **What:** ~22 instances of hardcoded hex colors instead of CSS variables in components and main.css
- **Impact:** Zero — app is light-only, no dark mode toggle exists. All hardcoded values match the design system.
- **When to fix:** When adding dark mode (Phase 3+)

### 7.2 EventBus Memory Leaks (Deferred)
- **What:** Components subscribe to EventBus in render() but never unsubscribe on navigation
- **Impact:** Negligible — ~5-6 components, 1-3 listeners each, KB-level memory. Page reload clears all.
- **When to fix:** When adding component lifecycle management (Phase 2)

### 7.3 Unused Code
- **`VisitorService` imported but unused in SyncService.js** — tree-shaken by Vite, harmless
- **`SyncService.prepareExport()` never called** — SyncManager builds its own export. Will be consolidated in Iteration 2.
- **`Visitor.primaryContactId` field** — set but never read. Leave for now.

### 7.4 Date Edge Cases
- **Timezone sensitivity** — dates use `new Date()` which is timezone-dependent. Works for single-timezone NGOs. Cross-timezone support would need UTC normalization.
- **Month-only dates use dummy year 2000** — works for reminders but visible in raw data exports.

### 7.5 Search Performance
- **O(n) full scan per keystroke** — debounced at 300ms, fine for <5000 visitors. Needs indexing for 10k+.

### 7.6 Whole-Record Merge Loses Parallel Edits
- **What:** If Priya updates address and Amit updates phone on the same visitor, the last import overwrites the first.
- **Impact:** Medium — coordinator can re-apply the lost change manually.
- **When to fix:** Phase 2 — field-level merge instead of whole-record replacement.

---

## 8. Architecture Decisions

### AD-1: Offline-First with JSON Sync
- **Decision:** No server. All data in localStorage. Sync via JSON file exchange.
- **Rationale:** Indian NGO volunteers often work in areas with poor connectivity. JSON files can be shared via WhatsApp even on 2G.
- **Trade-off:** Can't do real-time sync. Max ~5000 visitors per machine (localStorage limit).
- **Review when:** User base exceeds 5000 visitors per machine.

### AD-2: Single-File Build
- **Decision:** Vite builds everything into one `index.html` (via vite-plugin-singlefile).
- **Rationale:** Enables the app to run from `file://` protocol (double-click to open on desktop). Also works inside Capacitor WebView.
- **Trade-off:** No code splitting. Entire app downloaded at once (~192KB gzipped).

### AD-3: Phone Number as Natural Key
- **Decision:** Use SELF contact's first phone (normalized to last 10 digits) as the deduplication key for cross-machine visitor matching.
- **Rationale:** In Indian NGO context, mobile number is the most persistent unique identifier. Names have spelling variations, addresses change.
- **Guard rails:** Never match empty phones. Different names = flag as duplicate, don't auto-merge. Similar names only = auto-merge.

### AD-4: Root Authority for Deletions
- **Decision:** If Root deletes a visitor (and deletion is newer than incoming data), the deletion is preserved.
- **Rationale:** Root is the master. If coordinator deliberately removes a contact, field volunteers shouldn't be able to resurrect it via sync.

### AD-5: No Framework
- **Decision:** Vanilla JS, no React/Vue/Angular.
- **Rationale:** Simplicity, no build complexity, tiny bundle size, works on old WebViews.
- **Trade-off:** Manual DOM manipulation, no virtual DOM, no component lifecycle management.

---

## 9. Resumption Guide

> **Read this section when starting a new conversation/iteration.**

### Step 1: Understand Context
```
Read these files in order:
1. CLAUDE.md                    — Architecture & conventions
2. PROJECT_PLAN.md (this file)  — Full requirements, roadmap, history
3. git log --oneline -10        — Recent changes
4. git status                   — Uncommitted work
```

### Step 2: Check Current Iteration
- Look at Section 3 (Iteration History) for what was last completed
- Look at Section 6 (Enhancement Roadmap) for what's next
- Check Section 7 (Known Issues) before starting new work

### Step 3: Before Writing Code
- Read the relevant requirement section in detail
- Read the actual source files you'll be modifying
- Verify the build works: `npx vite build`

### Step 4: After Completing Work
- Update Section 3 with the new iteration entry
- Update Section 6 checkboxes for completed items
- Update Section 7 if new issues were discovered
- Verify build: `npx vite build`
- Run dev server for testing: `npm run dev`

### Step 5: Key Files Reference
```
src/core/state.js              — Reactive state (singleton)
src/core/storage.js            — localStorage persistence
src/core/events.js             — EventBus + EVENTS constants
src/core/router.js             — Hash-based SPA routing
src/core/activation.js         — Master key + machine setup

src/models/Visitor.js           — Visitor model (has contacts[])
src/models/Contact.js           — Contact model (phones[], emails[], dates)
src/models/Interaction.js       — Interaction model
src/models/Reminder.js          — Derived reminder (not persisted)

src/services/VisitorService.js  — Visitor CRUD
src/services/SyncService.js     — Export/import merge logic
src/services/ReminderService.js — Reminder generation
src/services/InteractionService.js — Interaction CRUD
src/services/SearchService.js   — Search/filter/paginate

src/components/Visitors/VisitorList.js  — Visitor grid with filters
src/components/Visitors/VisitorForm.js  — 3-step creation wizard
src/components/Visitors/VisitorView.js  — Visitor detail + timeline
src/components/Reminders/ReminderDashboard.js — Reminder dashboard
src/components/Sync/SyncManager.js      — Export/import UI
src/components/Activation/ActivationScreen.js — First-run gate
src/components/UI/Toast.js              — Notification toasts

src/utils/constants.js          — All enums, defaults, patterns
src/utils/validators.js         — Input validation functions
src/utils/formatters.js         — Date/display formatting
src/utils/helpers.js            — ID generation, deep clone, download
src/utils/crypto.js             — Master key validation

src/styles/variables.css        — CSS design tokens
src/styles/main.css             — All styles

android/app/src/main/java/.../MainActivity.java  — WebView config
android/app/src/main/AndroidManifest.xml          — Permissions, security
capacitor.config.json                              — Capacitor settings
```

### Step 6: Testing Checklist
```
[ ] Activation flow (master key → machine setup → main screen)
[ ] Add visitor (3-step form, all fields)
[ ] View visitor detail
[ ] Edit visitor (add/remove phone, email, family member)
[ ] Delete visitor (soft delete)
[ ] Search and filter visitors
[ ] Reminders dashboard (urgent, upcoming, month view)
[ ] Export data (JSON download)
[ ] Import data (file picker + manual paste)
[ ] Import preview shows correct counts
[ ] Post-import data is correct
[ ] Build succeeds: npx vite build
[ ] Android: test on MI/Xiaomi device if available
```
