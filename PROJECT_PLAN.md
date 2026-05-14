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

**Version:** 3.0.3
**Tech Stack:** Vanilla JS (ES6 modules), vanilla CSS, Vite, Capacitor (Android) + native `SmsPlugin`
**Last Updated:** 2026-05-14 (Iteration 9.1 — Empty-state bug + DNC audit + schema-version decoupling + diagnostic panel)
**Build:** 335.05 kB / 124.75 kB gzip · 103/103 tests pass · Android assets synced · `appVersionCode = 5` / `appVersionName = '3.0.3'`
**Pending before ship:** Real-device verification of (a) Iter 9 SMS permission flow + bulk send on MIUI/ColorOS/OneUI, (b) Iter 8 WhatsApp deep-link still works, (c) regression check on per-contact tel:/sms:/mailto: and text/file sync, (d) Iter 9.1 — Reminders tab now populates the Overdue section by default; empty-state CTAs route to current-month / 12-month views; App Health diagnostic panel in Settings — see Section 3 → Iteration 9.1 → "MUST-RUN"

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
| WhatsApp button stuck inside WebView on APK | FIXED (2026-05-06) | `allowNavigation: ["*"]` was forcing WebView to load wa.me inline; removed the wildcard so Capacitor externalises wa.me via Intent.ACTION_VIEW → Android App Links resolve to WhatsApp app |
| File export silently failed on Android APK | FIXED (2026-05-07) | `<a download>` in Capacitor WebView dropped the file in app-private storage; new `saveFile()` uses `navigator.share({files})` to open the system share sheet so the user can route to WhatsApp/Drive/Email. Desktop unchanged. |
| WCAG AA contrast failures on tertiary text | FIXED (2026-05-07) | Darkened `--color-text-secondary` to #4b5563 and `--color-text-tertiary` to #6b7280 (was #9ca3af, 2.69:1 ratio) |
| `.btn-sm` failed 44px touch target | FIXED (2026-05-07) | min-height 36→44, padding bump |
| Sync screen overload (4 parallel options) | FIXED (2026-05-07) | Single primary Send/Receive card + collapsible "More options" |
| Reminder snooze popover overlapping neighbouring buttons | FIXED (2026-05-07) | Replaced popover with native `<select>` dropdown |
| Visitor form errors only via Toast (couldn't find offending field) | FIXED (2026-05-07) | Inline `.field-error` placement under each field + focus + red border |
| WhatsApp deep-link button errors / silent-fails on Android APK | FIXED (2026-05-12) | `window.open('https://wa.me/…', '_blank')` routes through `WebChromeClient.onCreateWindow` in Capacitor — bridge doesn't externalise. Iter 6.6's `allowNavigation` removal was necessary but not sufficient. New `InteractionLogger.openExternalUrl()` uses a synthetic-anchor click on Capacitor (goes via `shouldOverrideUrlLoading` → `Intent.ACTION_VIEW`); keeps `window.open` on desktop. Same proven pattern as `_openProtocolLink` for tel:/sms:/mailto:. |
| Bulk birthday/anniversary SMS missing as a reliable comm channel | FIXED (2026-05-14) | Iter 9. New `SmsPlugin` Java class + `SmsService` JS wrapper. On Capacitor + SEND_SMS granted → one-tap bulk send via `SmsManager.sendTextMessage()` paced 1.5s/msg from the volunteer's SIM. Permission denied / desktop → falls back to existing per-contact `sms:` protocol (already worked). Bulk SMS button added to ReminderDashboard batch bar (primary) and MyDayDashboard Today section. WhatsApp button demoted from primary to secondary but kept intact. No model / migration changes. |
| Reminders tab shows empty default view on quiet days | FIXED (2026-05-14) | Iter 9.1. `ReminderService.generateReminders` filter was `daysUntil >= 0`, silently dropping every overdue event — the `grouped.overdue` bucket was always empty. Widened to `daysUntil >= -30` so recent overdue items surface. Added window-aware `_isAlreadyContactedThisCycle` so contacted-this-year items don't reappear but next-year reminders still do. `ReminderDashboard` now renders an explicit "Overdue" section (red) above "This week" (orange) and "Upcoming" (yellow). When all three are empty, shows a CTA empty-state ("Show {currentMonth}" / "Show all 12 months") instead of a dead-end blank page. |
| DoNotContact flag not enforced at communication-button click | FIXED (2026-05-14) | Iter 9.1. Audit closed across all 4 comm channels: new `InteractionLogger._blockedByDoNotContact(visitorId, contactName)` is called at the start of `quickAction()` and at the start of `openWhatsApp/openCall/openSMS/openEmail`. VisitorView callsites updated to pass `vid` so the guard fires. Toast surfaces the block to the user. Fails open if `VisitorService.getById` errors (a stuck comm button is worse than a missed flag — the visitor list is authoritative). Closes known-issue 7.7. |
| Migration ran on every app version bump even with identical schema | FIXED (2026-05-14) | Iter 9.1. `storage.js` migration trigger was `state.version !== APP_VERSION`, so every v3.x → v3.y release ran the (idempotent but logging-noisy) v2→v3 migration and wrote state back to localStorage. Changed to schema-aware: only runs when version is missing or starts with `'1.'`/`'2.'`. v3 → v3 just refreshes the version stamp silently. Eliminates "Migrating from 3.0.0 to 3.0.X" console spam and the per-release write. |
| Field debugging blocked by no in-app self-check | FIXED (2026-05-14) | Iter 9.1. New "🩺 App Health" card in Settings: platform detection (Capacitor / Android browser / desktop), app version, machine name/role, visitor + interaction counts, known-machines count, last sync entry, storage usage with quota warning at 4MB, live SMS permission badge. Plus three test buttons that exercise the actual production code paths against the user's own number: "Test WhatsApp link" (opens `wa.me` via `InteractionLogger.openExternalUrl`), "Test SMS app" (opens `sms:` via `_openProtocolLink`), "Send 1 test SMS now" (dispatches one SMS through `SmsService.sendBulkNative` to verify the native bulk path). Volunteers can screenshot this panel when reporting issues. |

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

### Iteration 3 — UX Quick Wins: Dialogs, Toast, Settings, Dates, Empty States (2026-03-30)
**Status:** COMPLETE — ready to commit
**Scope:** 5 UX quick wins from Phase 2 roadmap

**Feature 1: Custom ConfirmDialog component**
- Replaced all native `confirm()`/`alert()` with styled Promise-based modal dialogs
- Supports danger/warning/info types, keyboard (Escape/Enter), backdrop click
- Info-only mode (single OK button) for multi-line sync results display

**Feature 2: Toast adoption**
- All `alert()` calls replaced with existing (previously unused) `Toast.show()` component
- Success, error, warning types used appropriately across all components

**Feature 3: Settings page**
- New `/settings` route with UI for reminder lookahead (1-90 days) and backup interval (1-30 days)
- Read-only machine info display (name, role, ID, activation date)
- App version info; saves via `StateManager.updateSettings()`

**Feature 4: Native date inputs**
- Replaced triple-dropdown (day/month/year selects) with `<input type="date">` + "Year unknown" checkbox
- Month-only dates preserved (year=2000 dummy convention unchanged)
- Works on Capacitor/Chrome WebView on Android

**Feature 5: Improved empty states**
- Context-aware messages (filtered search vs no data) with emoji icons and actionable hints
- Applied to: VisitorList, ReminderDashboard, VisitorView timeline

**Files Changed:**
| File | Change |
|------|--------|
| `src/components/UI/ConfirmDialog.js` | NEW — Promise-based modal dialog component |
| `src/components/Settings/SettingsPage.js` | NEW — Settings page with preferences + machine info |
| `src/main.js` | Added SettingsPage import, route registration, nav link |
| `src/components/Visitors/VisitorForm.js` | Native date inputs, Toast/ConfirmDialog adoption |
| `src/components/Visitors/VisitorView.js` | ConfirmDialog for delete, Toast, improved timeline empty state |
| `src/components/Visitors/VisitorList.js` | Context-aware empty state with icons |
| `src/components/Sync/SyncManager.js` | Replaced ~16 alert() + 2 confirm() with Toast/ConfirmDialog |
| `src/components/Reminders/ReminderDashboard.js` | Toast adoption, improved empty state |
| `src/styles/main.css` | Modal, empty state, settings page, date field CSS |

**Remaining `prompt()` calls** (out of scope — need input dialog component):
- VisitorView.js: "Enter interaction notes" prompt
- ReminderDashboard.js: "Add a quick note" prompt

**Post-review hardening (same iteration):**
- Fixed XSS: ConfirmDialog and Toast now escape all user-supplied strings (textContent/escapeHtml)
- Fixed null crash: SettingsPage handles `getMachineInfo()` returning null
- Fixed race condition: SyncManager `performImport()` now properly awaited
- Fixed modal: Added ARIA attributes (role=dialog, aria-modal), focus trap (Tab key), scroll lock (body overflow), singleton guard
- Fixed accessibility: Toast container now has `aria-live="polite"` and `role="status"`
- Fixed touch targets: Year unknown checkbox enlarged to 44px min-height
- Fixed settings integration: ReminderDashboard now reads `reminderLookahead` from StateManager.getSettings()
- Fixed XSS: VisitorForm tags rendering now uses escapeHtml()

### Iteration 4 — Communication, Interaction Logging, Consent, Batch Greetings (2026-04-01)
**Status:** COMPLETE — committed and pushed
**Scope:** Full interaction logger, quick-log on reminders, WhatsApp deep links, one-tap communication, consent capture, do-not-contact, message templates, v2-to-v3 migration, batch greeting queue

*(See git commit 5f45b5e for full details)*

### Iteration 9.1 — Reminders Bug Fix + DNC Audit + Schema Decoupling + App Health (2026-05-14)
**Status:** CODE COMPLETE — ready for real-device test, ships as v3.0.3 (bundled with Iter 8 + Iter 9 in the same APK)
**Scope:** Owner reviewed the Iter 9 build and asked "what can be fixed now to be in a better position." Five fixes, all purely additive, zero sync-code touched.

**Driver:** Three real bugs surfaced during review (one of which had been latent since v3 launched), one known-issue audit (#7.7 DoNotContact), and one debugging-position improvement. No new features; the goal is "make existing flows behave as documented."

**Files Changed:**
| File | Change |
|------|--------|
| `src/services/ReminderService.js` | **Bug fix A:** `generateReminders` filter widened from `daysUntil >= 0 && <= ahead` to `daysUntil >= -back && <= ahead` (back defaults to 30 days, configurable via `settings.reminderLookbackDays`). New `_isAlreadyContactedThisCycle(reminderId, actions, windowDays)` skips reminders already marked contacted within the current rolling window — window-aware so next-year reminders still fire. `getGroupedReminders.overdue` is no longer always empty. |
| `src/components/Reminders/ReminderDashboard.js` | **Render D:** `applyFilters` now splits into three buckets (overdue / urgent / upcoming) instead of two. `renderDashboardViews` renders an Overdue section (red dot) above urgent and upcoming. New `_renderSmartEmptyState()` replaces the dead-end "No reminders found" with two CTAs: "Show {currentMonth}" (sets selectedMonth to current) and "Show all 12 months" (widens lookahead to 365). Empty-state CTAs wired in `attachEventListeners`. |
| `src/components/UI/InteractionLogger.js` | **Audit B:** new static `_blockedByDoNotContact(visitorId, contactName)` looks up the visitor and short-circuits with a Toast if `doNotContact === true`. Called at the start of `quickAction()`, `openWhatsApp()`, `openCall()`, `openSMS()`, `openEmail()`. The four `open*` methods gained an optional `visitorId` parameter (default null = legacy callsites that don't have a visitor ID bypass the check). Fails open on lookup error. |
| `src/components/Visitors/VisitorView.js` | Pass `visitor.id` into each `open*` call so the guard activates on the per-visitor comm buttons too. |
| `src/core/storage.js` | **Decoupling C:** `loadState` migration check changed from `state.version !== APP_VERSION` to `!state.version \|\| starts with '1.' \|\| starts with '2.'`. v3.x → v3.y releases now just refresh the version stamp silently without re-running the migration. Eliminates console-log noise and an unnecessary localStorage write per app open. |
| `src/components/Settings/SettingsPage.js` | **Diagnostic E:** new "🩺 App Health" card after the SMS Sending card. `_renderDiagnosticPanel()` shows platform / version / machine / counts / sync / storage / SMS-permission. `_wireDiagnosticPanel()` wires three test buttons (WhatsApp link / SMS protocol / native bulk SMS) that take a user-supplied phone number and exercise the actual production comm paths. Imports `StorageManager`, `InteractionLogger`, `normalizePhone`, `formatDateShort`. |
| `src/utils/constants.js` | `APP_VERSION '3.0.2' → '3.0.3'`. |
| `android/variables.gradle` | `appVersionCode = 4 → 5`, `appVersionName = '3.0.2' → '3.0.3'`. |
| `package.json` | `version '3.0.2' → '3.0.3'`. |

**Deliberately NOT changed (regression surface stays at zero):**
- Sync layer (`SyncService.js`, `TextSyncService.js`, `helpers.js` saveFile, `SyncManager.js`, `capacitor.config.json`) — untouched.
- Data model — no new fields. `reminderLookbackDays` is read via `settings.reminderLookbackDays ?? 30` so existing state without the field defaults correctly with no migration required.
- `Reminder.getUrgency()` — already returned `'overdue'` for `daysUntil < 0`; we just needed to stop filtering those out before they reached the classifier.
- The native `SmsPlugin.java` — untouched.

**Verification (done locally before handoff):**
- `npx vite build` → 335.05 kB / 124.75 kB gzip (+12 kB vs Iter 9; accounts for the diagnostic panel UI + overdue section + DNC guard wiring).
- `npx vitest run` → 103/103 pass (no test changes needed; the idempotency-of-migration test still passes because the schema-decoupled path preserves all data exactly as before).
- `npx cap sync android` → clean.

**MUST-RUN before shipping (real-device, install fresh APK after versionCode bump 4→5):**

*Iter 9.1 new behavior — must verify:*
- [ ] Open Reminders tab with a visitor whose birthday is in the past 30 days. Page shows an **Overdue** section (red dot) above This week / Upcoming. Previously the page was blank for this exact scenario.
- [ ] On a device with zero visitors near today's date (no past 30 days, no next 30 days of events), open Reminders → see the smart empty-state with "Show {currentMonth}" + "Show all 12 months" buttons. Tap each → views switch correctly; the dropdown reflects the selection.
- [ ] Mark a recent past birthday's reminder as **Called** → refresh Reminders → that overdue item disappears (idempotency-of-this-cycle check). Wait a year (or hack the system clock to next year) → same reminder reappears (window-aware dedup).
- [ ] On a visitor with `doNotContact: true` (force the flag via Settings → Visitor edit, or via console for testing), open the Reminders tab → no tile for that visitor. Then attempt to call `InteractionLogger.openWhatsApp` directly with that visitor's ID (e.g., via console) → Toast appears: "*X* is marked Do Not Contact — communication blocked." (Defense-in-depth check; in normal flow you'd never see this because reminders are pre-filtered.)
- [ ] Open the app fresh after the v3.0.3 install → console should NOT log "Migrating from version X.X.X to 3.0.3" (schema didn't change). It should also NOT trigger a localStorage write at startup.
- [ ] Open Settings → scroll to "🩺 App Health" → verify table shows correct platform, machine name, visitor count, sync timestamp, storage in KB, SMS permission state.
- [ ] In the App Health panel, type your own 10-digit mobile number and tap **Test WhatsApp link** → WhatsApp opens to your own chat with "App health test — please ignore." prefilled. Close WhatsApp.
- [ ] Same panel → tap **Test SMS app** → system SMS app opens with your number + prefilled text. Close it.
- [ ] Same panel → tap **Send 1 test SMS now** → if permission isn't granted, runtime dialog appears; grant → one SMS arrives at your inbox from your own number with "App health test — please ignore.". Toast confirms "Test SMS dispatched." (This proves the SmsPlugin path end-to-end on a single message before running a real bulk batch.)

*Iter 9 + 8 carry-forward — must still pass:*
- [ ] Bulk SMS from MyDayDashboard / ReminderDashboard still works as documented in Iter 9 MUST-RUN.
- [ ] Per-contact 💬 / 📱 / 📞 / ✉ buttons still open the right apps with prefilled content.
- [ ] Existing snooze / Visited / ⋯ buttons still work.

*Iter 7 carry-forward — sync paths:*
- [ ] File export + import on Android APK (share sheet) and laptop (download).
- [ ] Text export + import on both platforms.
- [ ] 360px width and 44px touch targets across screens.

**If the Overdue section is too noisy** (e.g., a coordinator with 200 visitors sees 30 overdue items every morning):
- Tune `settings.reminderLookbackDays` to a smaller window — UI tuning surface is not yet exposed but the setting is honored if added directly to state. Default 30 is reasonable for an NGO; could narrow to 14 in a follow-up if field testing surfaces the noise.

---

### Iteration 9 — Native SMS Bulk Send + WhatsApp Demotion (2026-05-14)
**Status:** CODE COMPLETE — ready for real-device test, then ship as v3.0.2 (bundled with Iter 8 fix)
**Scope:** Owner reported communication front still feels broken after the WhatsApp saga and asked for a concrete, working bulk SMS path for birthday/anniversary greetings. Ship Iter 8 + Iter 9 together as one APK so volunteers get *both* the WhatsApp fix and a reliable independent SMS workhorse.

**Driver:** WhatsApp deep-link (Iter 8) is code-complete but untested on devices; OEM variation may still leave per-contact buttons unreliable. SMS via `sms:` URI already worked per-contact but had no bulk path — sending 30 birthdays meant 30 manual taps. The user lives in WhatsApp but their volunteer fleet runs on phones with SIMs; SMS from those SIMs is the most reliable comm channel we can build.

**Architectural decision: hybrid native + protocol fallback, with no removed features.**
- Capacitor + SEND_SMS granted → new native `SmsPlugin` dispatches `SmsManager.sendTextMessage()` per contact, paced at 1.5s/msg. One-tap bulk send for the volunteer's batch of today's birthdays.
- Anywhere else (desktop, iOS, permission denied) → no UI for bulk send; per-contact 📱 button still opens the system SMS app via the existing `sms:` URI / `_openProtocolLink` path that has worked since Iter 4. Zero regression.
- WhatsApp UI kept (don't waste Iter 6.6 + Iter 8 work) but visually demoted: SMS is now the primary blue CTA in the batch bar; WhatsApp is the secondary green one.

**Why this is the right shape for an NGO:**
- Sender is the volunteer's own number → personal touch (a feature, not a bug).
- Free / included in carrier plan → no API costs, no DLT registration overhead (P2P SMS from personal SIMs is exempt under TRAI rules; DLT applies to bulk gateway senders).
- Offline-first → uses cellular, not data.
- No Play Store policy issue → app is sideloaded.

**Files Changed:**
| File | Change |
|------|--------|
| `android/app/src/main/java/org/sewasankalp/ngomitr/SmsPlugin.java` | NEW. `@CapacitorPlugin(name="Sms")` with `checkPermission`, `requestPermission`, `sendSms`. Uses modern `getSystemService(SmsManager.class)` on Android S+, `SmsManager.getDefault()` on older. Handles long messages via `divideMessage()` + `sendMultipartTextMessage()`. Returns granular error codes (`PERMISSION_DENIED`, `INVALID_ARGS`, `SEND_FAILED`) the JS layer uses to decide whether to abort the batch. |
| `android/app/src/main/java/org/sewasankalp/ngomitr/MainActivity.java` | `registerPlugin(SmsPlugin.class)` added to `onCreate()`. Existing WebView config unchanged. |
| `android/app/src/main/AndroidManifest.xml` | Added `<uses-permission android:name="android.permission.SEND_SMS"/>` with a comment documenting the runtime-grant flow and protocol fallback. `<queries>` already had `sms` from Iter 4 — no change there. |
| `src/services/SmsService.js` | NEW. `checkCapability()` → `{mode: 'native'\|'protocol', granted}`. `requestPermission()` triggers Android runtime grant. `sendBulkNative(items, {onProgress, shouldCancel})` paces 1.5s/msg, calls `InteractionService.log()` + `ReminderService.recordAction()` per successful send (preserves the v3 "every quick-action creates an Interaction record" rule from Iter 4). Aborts early on mid-batch permission revocation. `openProtocolForContact()` / `confirmProtocolSent()` for the per-contact fallback path. |
| `src/components/UI/SmsBatchQueue.js` | NEW. Three phases: `intro` (charge + sender disclosure), `sending` (live progress + cancel), `done` (summary stats + per-error breakdown). Visual: blue palette to distinguish from green `GreetingQueue`. Persists progress to localStorage for crash forensics. Permission-denied phase routes user to per-contact 📱 buttons. |
| `src/styles/main.css` | `.sms-batch-overlay` block at line ~1453, mirroring `.greeting-queue-*` but with blue `#0ea5e9` accent. `@keyframes sms-pulse` for the live-sending indicator. Mobile breakpoint at 640px. |
| `src/components/Reminders/ReminderDashboard.js` | Per-tile 📱 SMS button added next to 💬 WhatsApp (uses existing `InteractionLogger.quickAction('sms', …)` which was already wired in Iter 4 — just exposing it). Batch bar gets new 📱 Send SMS button (primary, blue) on Capacitor only; 💬 WhatsApp button demoted to secondary. Both share the same `collectSelected()` helper. Batch bar color shifted green → blue to signal SMS-primary. |
| `src/components/Dashboard/MyDayDashboard.js` | Today section now shows "📱 Send SMS to all N" button when ≥2 reminders have valid phones AND we're on Capacitor. Per-row 📱 SMS button added beside 💬. New helpers: `_countSmsEligible`, `_collectSmsItems`, `_isCapacitor`. |
| `src/components/Settings/SettingsPage.js` | New "📱 SMS Sending" card at bottom: shows permission state (Granted / Not granted / N/A on desktop), one-click "Grant SMS permission" button, charge + sender disclaimer. Async `_wireSmsPermissionPanel` polls `SmsService.checkCapability()` on render. |
| `src/utils/constants.js` | `APP_VERSION '3.0.0' → '3.0.2'` (was stale even before this iter — now correct). No new constants — the SMS rate-limit + batch-cap live in `SmsService.js` as named exports. |
| `android/variables.gradle` | `appVersionCode = 3 → 4`, `appVersionName = '3.0.1' → '3.0.2'`. |
| `package.json` | `version '3.0.0' → '3.0.2'`. |
| `tests/sms-service.test.js` | NEW. 12 unit tests covering: capability detection (no Capacitor / no plugin / granted / denied / plugin error), batch send happy path, invalid phone rejection, early-abort on PERMISSION_DENIED, `shouldCancel` honoured, pacing constant sanity check, permission request forwarding. Plugin + dependencies mocked via `vi.mock`. |

**Deliberately NOT changed:**
- `InteractionLogger.openSMS()` and `_openProtocolLink()` — already correct; the protocol fallback path reuses them as-is. Zero risk to per-contact SMS button which has worked since Iter 4.
- `GreetingQueue.js` — WhatsApp batch flow untouched. SmsBatchQueue is a parallel component, not a replacement.
- Data model (`Visitor`, `Interaction`, `Settings`, `State`) — no new fields. SMS interactions use existing `INTERACTION_TYPES.SMS` + existing `messageTemplates.birthday/anniversary`.
- `StorageManager.migrateState()` — no migration needed.
- `capacitor.config.json` — `allowNavigation` absence is load-bearing (Iter 6.6) and we don't touch it.
- `SyncService`, `TextSyncService`, `ReportService` — sync surface unchanged.

**Verification (done locally before handoff):**
- `npx vite build` → 323.55 kB / 121.65 kB gzip (+20 kB vs Iter 8; accounts for SmsService + SmsBatchQueue + CSS + dashboard wiring + Settings panel). Comfortably under any practical single-file budget.
- `npx vitest run` → 102/102 tests pass (90 pre-existing + 12 new SMS tests).
- `npx cap sync android` → clean; web assets copied to `android/app/src/main/assets/public/`; plugin auto-discovered via `registerPlugin()` in MainActivity.

**MUST-RUN before shipping (real-device, install fresh APK after versionCode bump 3→4):**

*Iter 9 SMS path — the new feature:*
- [ ] First-run: on MIUI/HyperOS, open Settings → "📱 SMS Sending" → tap "Grant SMS permission" → Android runtime dialog → tap Allow → status flips to "✅ Permission granted — bulk SMS ready".
- [ ] Same on ColorOS/Realme and OneUI/Samsung. OEM permission UI variations may differ but the result must be Allow → status flip.
- [ ] MyDayDashboard "Today" → if 2+ contacts have valid phones, "📱 Send SMS to all N" button appears at top of the Today card. Tap → intro modal with charge disclaimer + sender disclosure → Start sending → progress UI → all messages dispatched within ~N×1.5s → summary shows N sent / 0 failed → close → reminder rows refresh.
- [ ] Same flow from ReminderDashboard batch bar: select 3+ tiles, "📱 Send SMS" → batch flow.
- [ ] Each sent SMS lands in the recipient's SMS inbox from the volunteer's number, with the templated message (`{name}` + `{org}` substituted).
- [ ] Open VisitorView for one of the recipients → interaction timeline shows "SMS" entry with "sent (Birthday)" notes. (Confirms `_logAndMark` ran.)
- [ ] Open the reminder that was selected → it now shows "contacted" action recorded. (Confirms reminder marking.)
- [ ] Cancel mid-batch: tap Cancel on the sending modal → no more sends after the in-flight one; summary reflects partial count.
- [ ] First deny test: tap "Send SMS" → at Android permission dialog tap Deny → modal flips to "SMS Permission Needed" with both "Use per-contact instead" and "Grant permission" buttons.
- [ ] Second deny test ("Don't ask again" path): tap Grant permission → Deny again with the Don't-ask checkbox → modal flips to "Permission Was Blocked" with system-settings instructions (no fruitless retry button).
- [ ] Already-revoked test: revoke SMS permission in Android system Settings, return to app, tap bulk SMS → modal opens the permission-denied flow gracefully; per-contact 📱 button on each tile still opens system SMS app (protocol fallback unaffected).

*Iter 9 per-contact SMS button — needs to keep working:*
- [ ] Tap 📱 on a reminder tile → system SMS app opens with the recipient's number prefilled + the templated message in the body. (Existing `sms:` URI path via `InteractionLogger.openSMS`.)
- [ ] Same on MyDayDashboard reminder rows.

*Iter 8 regression check — WhatsApp must still work after Iter 9 changes:*
- [ ] Tap 💬 on a reminder tile → WhatsApp app opens to that chat with prefilled message (the Iter 8 fix is untouched; this just confirms we didn't regress).
- [ ] Batch bar "💬 WhatsApp" button (now secondary green) → GreetingQueue opens → send per contact still works.

*Existing comm regression check:*
- [ ] 📞 Call still opens dialer (tel: via `_openProtocolLink`).
- [ ] ✉ Email still opens mail client (mailto:).
- [ ] Per-contact 📱 SMS button (the existing one wired in `InteractionLogger.quickAction`) opens system SMS app.
- [ ] Web build on desktop: bulk SMS button is *not* rendered (correct — no SIM); per-contact 📱 button still works to open whatever SMS handler the OS has.

*Iter 7 deferred items — must re-run after the Iter 9 changes (carry forward from Iter 8 MUST-RUN):*
- [ ] File export — Android APK: "Save (opens share sheet)" → share sheet → pick WhatsApp → .json attached.
- [ ] File export — laptop: "Save (file)" → .json downloads, valid JSON.
- [ ] Text export — Android APK: "Share via WhatsApp" → share sheet → pick WhatsApp → message preview includes sync text.
- [ ] Text export — laptop: "Copy and paste into WhatsApp" → status shows "Copied to clipboard".
- [ ] Text import (both platforms): paste sync messages → "✓ All N messages received" → Import succeeds, counts correct.
- [ ] File import (both platforms): "Open .json file" → preview shows machine + counts → import succeeds.
- [ ] 360px width: no horizontal scroll on Sync screen, ReminderDashboard, VisitorForm, MyDayDashboard, Settings.
- [ ] All comm buttons hit 44px touch target (Settings SMS card included).

*Local-record warning test (the partial-write path):*
- [ ] Fill localStorage close to its quota (~5 MB), trigger bulk SMS → SMSes still arrive at recipients, summary banner shows "⚠️ N message(s) were sent but couldn't be recorded locally". Not strictly required for release but worth confirming the warning path renders if you can engineer the condition.

**If SMS bulk send fails on a specific OEM:**
- Most likely cause is carrier-side anti-spam throttling — try lowering batch size or increasing `SMS_SEND_INTERVAL_MS` (currently 1500ms). Document the OEM + carrier combination in Iter 9.1.
- Permission flow on Xiaomi MIUI sometimes adds an extra "Background SMS sending" approval step in MIUI's own permission center beyond Android runtime — document this for the volunteer install guide.
- Fall back to per-contact 📱 button — it always works, just slower.

**Build / distribution (no change from Iter 8):**
- GitHub Actions `build_apk.yml` produces `app-debug.apk` artifact on push to main.
- Sideload to volunteer phones over WhatsApp / direct download.
- Volunteer install instructions should now include a one-time "Grant SMS permission in Settings → 📱 SMS Sending" step.

---

### Iteration 8 — WhatsApp Navigation Hotfix + Prod Release Prep (2026-05-12)
**Status:** COMPLETE — ready for real-device test, then ship
**Scope:** Diagnose and fix the per-contact WhatsApp deep-link regression discovered after Iter 7 device testing; bump app version for install-over-install; consolidate prod-release checklist.

**Bug context (reported by owner during Iter 7 device test):**
- Per-visitor / per-reminder "💬 WhatsApp" button errored / silently failed on Android APK.
- On laptop, the same button opened WhatsApp Web (functionally OK, but not consistent UX).
- Iter 6.6 had removed `allowNavigation: ["*"]` expecting wa.me to externalise via Intent — and it did for *navigation*, but the call sites use `window.open(url, '_blank')`, which on Capacitor Android routes through `WebChromeClient.onCreateWindow`. The bridge externalises only via `shouldOverrideUrlLoading`. So the wildcard removal was necessary but not sufficient.

**RCA recap (critical to remember for any future external-URL feature):**
| Path | Routes through | Capacitor externalises? |
|------|----------------|-------------------------|
| `window.open(httpsUrl, '_blank')` | `WebChromeClient.onCreateWindow` | NO — popup is blocked / silent fail |
| Anchor `.click()` (no `target=_blank`) | `shouldOverrideUrlLoading` | YES — `Intent.ACTION_VIEW` fires |
| `window.location.href = url` | `shouldOverrideUrlLoading` | YES — but navigates the WebView page first |

The synthetic-anchor pattern is what already powered tel:/sms:/mailto: in `InteractionLogger._openProtocolLink` (Iter 4). Applying the same pattern to HTTPS external URLs is the cheap fix.

**Files Changed:**
| File | Change |
|------|--------|
| `src/components/UI/InteractionLogger.js` | New static `openExternalUrl(url)` — platform-aware: synthetic anchor click on Capacitor, `window.open(url, '_blank', 'noopener,noreferrer')` elsewhere. New `_isCapacitorNative()` helper. `openWhatsApp()` now routes through it instead of `window.open` directly. |
| `src/components/UI/GreetingQueue.js` | Batch greeting send button now calls `InteractionLogger.openExternalUrl(url)` instead of `window.open(url, '_blank')`. Comment added explaining why. |
| `android/variables.gradle` | `appVersionCode = 2 → 3`, `appVersionName = '3.0.0' → '3.0.1'`. Required for install-over-install of test APK on devices that already have the Iter 7 build. |

**Deliberately NOT changed:**
- `InteractionLogger._openProtocolLink` — already correct for tel:/sms:/mailto:; HTTPS needs separate handling because synthetic-anchor-click without `target=_blank` would navigate the desktop page away.
- `capacitor.config.json` — `allowNavigation` already correctly absent (per Iter 6.6); adding `wa.me` back to the list would re-break externalisation.
- `src/utils/helpers.js:188` `window.open(dataUri, '_blank')` — that's the deepest fallback in `saveFile()` and uses a `data:` URI, not an external HTTPS URL. Leave it as-is.
- `AndroidManifest.xml` `<queries>` — wa.me entry already present (Iter 6.6 audit).
- `MainActivity.java` — no native code changes; the WebView config is correct.

**Verification (done locally before handoff):**
- `npx vite build` → 303.50 kB / 117.13 kB gzip (+0.41 KB vs Iter 7, well within noise — accounts for the new helper + comments)
- `npx vitest run` → 90/90 tests pass
- `npx cap sync android` → clean; web assets copied to `android/app/src/main/assets/public/`

**MUST-RUN before shipping (real-device, install fresh APK after versionCode bump):**

*Primary — the bug we just fixed:*
- [ ] Tap "💬 WhatsApp" on a visitor with a phone number on MIUI/HyperOS → WhatsApp app opens to that chat with the prefilled message in the input box.
- [ ] Same on ColorOS/Realme.
- [ ] Same on OneUI/Samsung.
- [ ] Test on a phone *without* WhatsApp installed → falls back to browser opening wa.me "Continue to chat" page (graceful degradation).
- [ ] Tap a 💬 button on a reminder tile (ReminderDashboard) → same WhatsApp app opens.
- [ ] Trigger Batch Greeting Queue from MyDayDashboard → Send button → WhatsApp opens to that contact → confirm "Did you send?" dialog appears on return.

*Regression check — comms that already worked:*
- [ ] Tap "📞 Call" on a visitor → phone dialer opens with number prefilled (uses `_openProtocolLink` `tel:`)
- [ ] Tap "✉ SMS" → SMS app opens with number + prefilled message (uses `_openProtocolLink` `sms:`)
- [ ] Tap "📧 Email" → email client opens with prefilled subject + body (uses `_openProtocolLink` `mailto:`)
- [ ] Web build still opens new tab to WhatsApp Web on desktop browser (laptop UX preserved)

*Iter 7 deferred checklist — execute together with the above to clear the prod release backlog:*
- [ ] File export — Android APK: "Save (opens share sheet)" → share sheet → pick WhatsApp → .json attached
- [ ] File export — laptop: "Save (file)" → .json downloads, valid JSON
- [ ] Text export — Android APK: "Share via WhatsApp" → share sheet → pick WhatsApp → message preview includes sync text
- [ ] Text export — laptop: "Copy and paste into WhatsApp" → status shows "Copied to clipboard"
- [ ] Text import (both platforms): paste sync messages → "✓ All N messages received" → Import succeeds, counts correct
- [ ] File import (both platforms): "Open .json file" → preview shows machine + counts → import succeeds
- [ ] 360px width: no horizontal scroll on Sync screen, ReminderDashboard, VisitorForm
- [ ] All comm buttons hit 44px touch target

**If WhatsApp still fails on a specific OEM after this fix:**
- Cut the WhatsApp deep-link UI on that platform path only — fall back to copying the message + opening the WhatsApp app blank (no contact prefill).
- Document in a new Iter 8.1 entry; don't block the rest of v3.0.1 release on it.
- The text-sync path (TextSyncService → `navigator.share({text})`) is independent and not affected by this fix or its potential failure.

**Build / distribution path (no change from Iter 7):**
- GitHub Actions `build_apk.yml` produces `app-debug.apk` artifact on push to main.
- Sideload to volunteer phones over WhatsApp / direct download.
- Release-signed APK and Play Store remain deferred (per Iter 6.5 AD — debug APK sideloads fine for the NGO's distribution model).

---

### Iteration 7 — Pre-release UX Hardening + Sync Platform Parity (2026-05-07)
**Status:** COMPLETE — ready to commit
**Scope:** UX redesign of the three worst screens (Sync, Reminders, VisitorForm), cross-cutting CSS token fixes, and sync platform-parity work so file sync works on mobile and text sync is clearly available on laptop.

**Driver:** Pre-release UX audit (81 specific findings) flagged that "many options are very difficult to read and understand" and that file-based sync silently fails on Capacitor APK while text-based sync works on mobile but isn't packaged for laptop discovery. Owner asked for both sync paths to work on both platforms.

**Stages executed (in order):**

**Stage 0 — Sync platform parity** (the ownership-critical work)
- New `getSyncCapabilities()` and `saveFile()` functions in `src/utils/helpers.js`
- `saveFile()` is platform-aware: on mobile/Capacitor it uses `navigator.share({files: [File]})` so the system share sheet hands the file off to WhatsApp / Drive / Email; on desktop it falls back to the standard `<a download>` flow. This fixes the documented MIUI/ColorOS regression where `<a download>` silently dropped the file inside app-private storage.
- Existing `downloadFile()` kept as a backward-compat alias that returns a (discarded) Promise — all 3 callers (`SyncManager` × 2, `MyDayDashboard` CSV export) automatically gain the new behavior.
- Text-sync path on laptop already worked via `navigator.clipboard.writeText` fallback inside `TextSyncService.shareText`; new SyncManager UI just makes that path discoverable by labelling the buttons platform-aware.

**Stage A — CSS tokens & primitives** (`variables.css`, `main.css`)
- Darkened `--color-text-secondary` (#6b7280 → #4b5563, 7.59:1 AAA) and `--color-text-tertiary` (#9ca3af → #6b7280, 4.84:1 AA pass on white). Fixes WCAG AA failure cited at multiple sites.
- `.btn-sm`: min-height 36px → 44px, padding bumped (now meets touch target on mobile)
- `.form-input`: border #475569 → #cbd5e1 (lighter resting state, less visual noise)
- `.form-label`: hardcoded color → `var(--color-text-primary)`, 0.95rem → 1rem
- `.quick-action-btn`: removed `!important` overrides, added `min-height: 44px`
- `.visitor-grid`: `minmax(280px, 1fr)` → `minmax(min(280px, 100%), 1fr)` (fixes 360px horizontal scroll)
- `.app-nav` mobile: dropped contradictory `overflow-x: auto + flex-wrap`, kept clean wrap
- New `.field-error` / `.field-invalid` styles for inline form errors

**Stage B — SyncManager redesign** (`src/components/Sync/SyncManager.js` rewritten)
- Single primary card with role-aware copy: Coordinator sees "Share with volunteers / Import from a volunteer", Volunteer sees "Send to coordinator / Get latest from coordinator". Replaces "satellite/root" jargon.
- Capability hint banner — labels the recommended path per device (text-share on mobile, file-download on desktop)
- Send / Receive shown side-by-side on desktop, stacked on mobile (responsive grid)
- Receive textarea auto-detects sync-text format AND raw JSON; one Preview button for both
- File picker collapsed under a single "Open .json file" button (drag-drop dropzone removed — never useful on mobile)
- More options (Full backup, Restore, Sync history, Known machines, Storage stats) collapsed under one `<details>` block
- Replaced jargon: "DM-SYNC markers" → "sync code", "chunks" → "messages", "merge" → "import", "satellite/root" → role-aware
- Single confirm verb everywhere: "Import" (was "Proceed with Import" / "Confirm Import" mixed)
- All textareas readable (was 0.7rem monospace; now 0.85rem)
- Preserves: SyncService.merge logic, TextSyncService encoding, pre-sync auto-backup, sync-history persistence, all functional import/export paths

**Stage C — ReminderDashboard redesign** (`src/components/Reminders/ReminderDashboard.js` rewritten)
- Filters now collapsible — hidden by default unless a filter is active (was 3 stacked filter rows before any reminder visible)
- Tile redesigned: cleaner top row (checkbox + icon + date + event-type pill), name + meta on its own line, single horizontal action row at the bottom
- Snooze popover replaced with native `<select>` dropdown — sidesteps the "popover overlaps neighbours" positioning bug
- Section headers softened: small color dot instead of red emoji + heavy gradient
- Batch greeting bar moved to a sticky pill that appears only when something is selected (was always-visible third filter row)
- "Live View" → "Upcoming view"; "Activities found" → "X reminders"; "Activities" → "events"
- Phone shows as proper link with primary color (was `color: inherit`, looked unclickable)
- Preserves: all reminder generation, snooze/contacted/visited recording via InteractionLogger.quickAction (data-flow rule kept), batch greeting queue start/resume, search/city/type/month filters, pagination

**Stage D — VisitorForm redesign** (`src/components/Visitors/VisitorForm.js` targeted edits)
- Progress steps wrap properly on 360px (flex-wrap + gap, no inline-flex margin overflow)
- Family card: dropped 4px primary-color stripe (visual noise across multiple cards), now uses 1px border like other cards
- Frequency target: replaced fragmented natural-language UI with checkbox toggle + revealed days input ("Remind me if I haven't contacted them" → number)
- Category step: added existing-category quick-pick chips so user sees previously-used values (was hidden inside datalist)
- Inputs: `inputmode="tel" autocomplete="tel"` on phones, `inputmode="email" autocomplete="email"` on emails, `inputmode="numeric"` on freq, `autocomplete="name|address-level2|street-address"` where applicable
- "Year unknown" → "Don't know the year (just month / day)"
- Inline error placement: new `showFieldError(fieldId, msg)` / `clearFieldErrors()` helpers + `.field-error` CSS — Toast-only validation replaced; errors now appear under the offending field with focus + red border
- Phone/email rows: `flex: 1; min-width: 0` on inputs and `flex: 0 0 auto; min-width: 44px` on remove buttons — fixes 360px overflow
- Family member: 3 dates in form-row stack cleanly on mobile (existing 640px break already in main.css)
- Added explicit `for=` / `id=` pairing on every label/input
- Preserves: 3-step flow, all validation rules, consent capture, smart-date 2000-sentinel convention, edit-existing-visitor flow

**Files Changed:**
| File | Change |
|------|--------|
| `src/utils/helpers.js` | Added `saveFile()` (Web Share API + download fallback) and `getSyncCapabilities()`; `downloadFile()` now a backward-compat alias |
| `src/styles/variables.css` | Darkened `--color-text-secondary` and `--color-text-tertiary` for WCAG AA |
| `src/styles/main.css` | `.btn-sm` 44px, `.form-input` border, `.form-label` token, `.quick-action-btn` no-important, `.visitor-grid` min(), `.app-nav` clean wrap, new `.field-error`/`.field-invalid` |
| `src/components/Sync/SyncManager.js` | Full rewrite — role-aware single primary card, capability hint, More options collapsible |
| `src/components/Reminders/ReminderDashboard.js` | Full rewrite — collapsible filters, simpler tiles, snooze via native select, sticky batch bar |
| `src/components/Visitors/VisitorForm.js` | Step 1 / Step 2 / Step 3 markup updates, inline error helpers, frequency toggle, category chips, autocomplete attrs |

**Verification:**
- `npx vite build` → 303.09 kB / 117.05 kB gzip (slight grow vs Iter 6.6's 301.59 / 116.55 — within noise; new help text and capability hint copy)
- `npx vitest run` → 90/90 tests pass (no regression)
- `npx cap sync android` → clean

**MUST-RUN before treating as shipped — real-device test checklist:**

*Sync platform parity (ownership critical):*
- [ ] **File export — laptop browser:** Click "Save (file)" — `.json` downloads. Open the file, verify it's valid JSON.
- [ ] **File export — Android APK:** Click "Save (opens share sheet)" — system share sheet appears. Pick WhatsApp → message sends with .json attached. Pick Drive → file uploads. Pick Email → attaches.
- [ ] **Text export — laptop:** Click "Copy and paste into WhatsApp". Status shows "Copied to clipboard". Paste into WhatsApp Web — text arrives.
- [ ] **Text export — Android APK:** Click "Share via WhatsApp". Share sheet opens with text. Pick WhatsApp → contact picker → message preview includes the sync text.
- [ ] **Text import — both platforms:** Paste a sync message into "Receive". Status shows "✓ All N messages received". Click Review → Import. Counts correct.
- [ ] **File import — both platforms:** Click "Open .json file", pick file. Preview shows source machine + counts. Import succeeds.
- [ ] **Multi-message text sync:** Generate a large export (100+ visitors). Verify "X messages" shown. Send all messages to receiver. Receiver pastes them one-by-one. Status shows partial → complete.

*UX redesign verification (per screen):*
- [ ] Sync screen at 360px width: no horizontal scroll, send/receive cards stack, more-options collapsed
- [ ] Reminder dashboard: filters hidden by default, tile actions one row, snooze dropdown opens cleanly
- [ ] Visitor form: progress steps wrap, phone/email rows don't overflow, frequency toggle reveals days input, missing-name error appears under field with red border
- [ ] All buttons hit 44px touch target on mobile (especially "Add another phone", "✕ Remove")

*OEM coverage (from Iter 6.5 checklist that must finally be executed):*
- [ ] MI/Xiaomi (MIUI/HyperOS): WhatsApp button externalises to app, file share opens system sheet
- [ ] Oppo/Realme (ColorOS): same
- [ ] Samsung (OneUI): same

**Deferred to a future iteration:**
- Dashboard, VisitorView, VisitorList, InteractionHistory, SettingsPage, ActivationScreen — audit findings exist but these aren't blockers; redesign deferred. The token fixes from Stage A help all of them indirectly.
- Dark mode completion (currently partial — only neutral tokens flip; brand colors don't). Removing or completing is out of scope.

---

### Iteration 6.6 — WhatsApp Externalisation Hotfix (2026-05-06)
**Status:** COMPLETE — ready to commit
**Scope:** One-line config change to fix WhatsApp button getting stuck inside the WebView on deployed APK.

**Symptom:** Tapping any WhatsApp button (VisitorView, ReminderDashboard, MyDayDashboard, GreetingQueue) navigated the Capacitor WebView itself to `https://wa.me/...` — user saw the wa.me "Continue to chat" landing page with no way back into the app.

**RCA:**
- All WhatsApp buttons funnel through `InteractionLogger.openWhatsApp()` and `GreetingQueue` Send, which build a `https://wa.me/91<n>?text=...` URL and call `window.open(url, '_blank')`.
- `capacitor.config.json` had `"allowNavigation": ["*"]`. The wildcard told Capacitor's `BridgeWebViewClient` to load any URL inline. So `https://wa.me/...` was treated as in-app navigation and never reached `getBridge().launchIntent(uri)`.
- Iter 6.5 audit listed `allowNavigation: ["*"]` as "already correct" — that conclusion was wrong; wildcard is precisely what suppressed Android's intent resolution for wa.me.
- The `<queries>` entry for `wa.me` in `AndroidManifest.xml` was already correct (Android 11+ visibility) — it was always a one-line config issue, not a manifest, JS, or native code issue.

**Files Changed:**
| File | Change |
|------|--------|
| `capacitor.config.json` | Removed `"allowNavigation": ["*"]` from server block |

**Why this fix preserves all platforms:**
- Phone APK + WhatsApp installed: WebView refuses external nav → Capacitor fires `Intent.ACTION_VIEW` → Android App Links resolve `wa.me` to WhatsApp app → opens directly to that number's chat with prefilled text.
- Phone APK + WhatsApp not installed: same intent → falls back to default browser → wa.me web page → "Continue to chat" flow.
- Desktop / mobile web: untouched — `window.open('https://wa.me/...', '_blank')` opens a new browser tab as before.

**Deliberately NOT changed:**
- `InteractionLogger.openWhatsApp()` JS — keeping `https://wa.me/` URL is what enables the web fallback path. Switching to `whatsapp://` scheme would have broken desktop browser users.
- `MainActivity.java` — no native code touched, preserving Iter 6.5 boundary.
- `AndroidManifest.xml` — `<queries>` already correct.

**Verification:**
- `npx vite build` → 300.62 kB / 116 kB gzip (identical to Iter 6.5 baseline, no regression)
- `npx cap sync android` → clean

**MUST DO before treating as shipped:**
- Install fresh debug APK on a real MIUI/HyperOS device; tap a WhatsApp button on a visitor with phone — confirm WhatsApp app opens to that chat with prefilled text.
- Repeat on ColorOS/Realme device.
- Repeat on a phone *without* WhatsApp installed — confirm browser opens wa.me page (graceful degradation).
- Smoke-test on web build: WhatsApp button still opens new browser tab to wa.me.

**Risk note:** If any feature relies on the WebView loading non-app HTTPS URLs inline, removing `allowNavigation: ["*"]` will externalise it. Source grep confirmed wa.me is the only external URL the app navigates to; resource loads (img/fetch/etc.) are unaffected since `allowNavigation` governs navigation only. If a regression surfaces, scope `allowNavigation` to specific hosts rather than restoring the wildcard.

---

### Iteration 6.5 — Android Deploy Hardening (2026-05-01)
**Status:** COMPLETE — ready to commit
**Scope:** Restore Android shell hygiene that was missing/regressed before shipping APK to MI/Xiaomi/Oppo devices. Strictly additive — no behavior change on the working Pixel baseline.

**RCA findings (corrections to earlier audit):**
- Earlier review claimed missing `colors.xml` would crash on MI. **WRONG** — Capacitor library `node_modules/@capacitor/android/.../res/values/colors.xml` provides `colorPrimary`/`colorPrimaryDark`/`colorAccent`. AAPT merges them at build time. The April-9 debug APK (`android/app/build/outputs/apk/debug/app-debug.apk`) builds and launches on Pixel proving this.
- Earlier review claimed `extractNativeLibs` missing breaks Oppo install. **MOSTLY WRONG** — `extractNativeLibs="false"` is the AGP default since 4.0; auto-applied at build time.
- Real residual risks for OEM deploy were narrower: versionCode stuck at 1 (update-blocker), no explicit `network_security_config` (defensive), no `dataExtractionRules` for Android 12+ (warning, not blocker), `<root-path>` in `file_paths.xml` (security smell — verified unused by app code; only Capacitor's library uses FileProvider for camera capture which the app doesn't expose).

**Files Changed:**
| File | Change |
|------|--------|
| `android/variables.gradle` | Added `appVersionCode = 2`, `appVersionName = '3.0.0'` |
| `android/app/build.gradle` | `versionCode`/`versionName` now read from `rootProject.ext` (was hardcoded `1` / `1.0`) — fixes "App not installed" on update |
| `android/app/src/main/res/xml/network_security_config.xml` | NEW — explicit cleartext + system + user CA trust (defensive for MIUI) |
| `android/app/src/main/res/xml/backup_rules.xml` | NEW — explicit Auto Backup include rules (Android 6-11) |
| `android/app/src/main/res/xml/data_extraction_rules.xml` | NEW — explicit cloud-backup + device-transfer rules (Android 12+, targetSdk 31+ requirement) |
| `android/app/src/main/AndroidManifest.xml` | Added `android:networkSecurityConfig`, `android:fullBackupContent`, `android:dataExtractionRules` references |
| `android/app/src/main/res/xml/file_paths.xml` | Removed `<root-path>` (security; FileProvider exposure of full filesystem) |

**Deliberately NOT changed:**
- `MainActivity.java` — Capacitor's `BridgeActivity` handles back-press; current `onResume` WebView config works on Pixel. Touching it = risk for zero benefit.
- `capacitor.config.json` — already correct (`androidScheme: "https"`, `allowNavigation: ["*"]`, `allowMixedContent: true`).
- Release signing config — out of scope; CI ships debug APK which sideloads fine. Add only when going to Play Store.
- `minifyEnabled` — leaving false; flipping to true requires proguard keep-rules audit which is a separate task.

**Verification:**
- `npx vite build` → 300.62 kB / 116 kB gzip (identical to Iter 6 baseline, no regression)
- `npx vitest run` → 7 files / 90 tests passing (identical to Iter 6 baseline)
- `npx cap sync android` → clean, web assets copied to `android/app/src/main/assets/public/`

**APK build:** Requires Java 21 + Android SDK. Recommended path: push to main, GitHub Actions workflow `build_apk.yml` produces `app-debug.apk` artifact. Local: `cd android && ./gradlew assembleDebug` (needs JDK 21).

**OEM test checklist (must run on real devices before treating as shipped):**
- MI/Xiaomi (MIUI/HyperOS): install → activate → add visitor → text-sync export to second device → verify import
- Oppo/Realme (ColorOS): same flow
- Samsung (OneUI): same flow
- For each: confirm WhatsApp deep link opens, tel:/sms:/mailto: open correct app, app survives backgrounding 5+ minutes, install of v3.0.1 over v3.0.0 succeeds (versionCode bump test)

---

### Iteration 6 — "The Share Release": WhatsApp-Native Sync & Reports (2026-04-14)
**Status:** COMPLETE — ready to commit
**Scope:** 5 features, plus deliberate deferral of 2 planned features to Iteration 7

**Plan reshape rationale:** Original Iteration 6 scope was 6 features (E1, E2, E3, A3, D2, G5). User feedback during session start identified that despite multiple iterations fixing file-sync bugs (BOM handling, paste fallback, MI file-access flags), the **root complaint remained**: files shared on WhatsApp often can't be re-opened after download on MIUI/ColorOS/OneUI due to OS-level Scoped Storage behaviour. This is not fixable at the app layer with current architecture — the solution is to **bypass files entirely** for typical sync operations. New feature H1 (WhatsApp-Native Text Sync) was elevated to the iteration. E1 (Analytics Dashboard) and D2 (Visit Planner) were deferred to Iteration 7 to keep scope manageable; they're valuable but not adoption-blockers like H1.

**Feature H1: WhatsApp-Native Text Sync** (new category H in VERSION_3_VISION.md)
- New `src/services/TextSyncService.js` — encode/decode/chunk/CRC32-verify sync packages as text blobs
- Compression: `CompressionStream('gzip')` with raw-base64 fallback for older WebViews
- Chunking: 3500 chars/chunk (safe for Android keyboards and WhatsApp paste) with live progress indicator on import
- Format: `====DM-SYNC v1 N/M z=1 c=<crc32>====` delimiters, resilient to surrounding noise (WhatsApp timestamps, sender names)
- Web Share API (`navigator.share({text})`) opens Android share sheet → user picks WhatsApp contact
- Clipboard fallback when share unavailable
- Live paste feedback: "Received 3 of 5 messages. Missing: 4, 5. Paste the remaining."
- Integrity via CRC32 over base64 payload — catches paste corruption before import
- 15 unit tests covering roundtrip, chunking, checksum, missing chunks, noise tolerance, UTF-8 (Marathi)

**Feature E2: Text Monthly Report + CSV Export**
- New `src/services/ReportService.js`
- Plain-text monthly summary (visitors, new, interactions by type, top cities, needs-attention) — copy/share buttons
- Full visitor CSV with engagement and interaction counts (UTF-8 BOM for Excel compatibility)
- Reports card added to `MyDayDashboard` with preview accordion

**Feature E3: Enhanced Per-Visitor Timeline Header**
- `VisitorView` header now shows contact frequency average (computed from interaction history)
- Shows target frequency if set (links to A3)
- Shows next action line: earliest pending follow-up OR next upcoming birthday/anniversary within 60 days

**Feature A3: Smart Contact Frequency**
- `VisitorForm` Step 3: optional "Remind me if not contacted in X days" field
- `ReminderService._generateFrequencyReminder()` creates a `ContactDue` reminder when `(last interaction OR createdAt) + frequencyDays <= today`
- Overdue contact reminders appear alongside event reminders with the ⏰ icon
- Excluded for `doNotContact` visitors and soft-deleted visitors (same filter chain as event reminders)

**Feature G5: Full Backup (Text-First + File Fallback)**
- Reshaped from "download file only" to dual-path
- Primary: "Copy Backup as Text" using TextSyncService — user sends to their own WhatsApp/email to save
- Secondary: "Download Backup File" for desktop users
- Includes everything (visitors, interactions, reminderActions, settings, syncLog, knownMachines)
- Restore: paste into backup restore textarea; creates safety pre-restore backup before replacing state

**Files Changed:**
| File | Change |
|------|--------|
| `src/services/TextSyncService.js` | NEW — gzip+base64+CRC32 text encoding, chunking, Web Share wrapper |
| `src/services/ReportService.js` | NEW — monthly text report + visitor CSV |
| `src/components/Sync/SyncManager.js` | Full rewrite — text-sync panels as primary, file sync as collapsed fallback, full backup section, restore from pasted backup |
| `src/components/Dashboard/MyDayDashboard.js` | Reports card with copy/share/CSV buttons and preview |
| `src/components/Visitors/VisitorView.js` | New `renderEngagementMeta()` with frequency avg + next action |
| `src/components/Visitors/VisitorForm.js` | Step 3 "Contact Frequency Target" field, formData + save handling |
| `src/services/ReminderService.js` | New `_generateFrequencyReminder()`, included in `generateReminders()` |
| `src/components/Reminders/ReminderDashboard.js` | Support ContactDue event type (⏰ icon, "Contact Due" label) |
| `src/styles/main.css` | Reports card styles |
| `tests/textsync.test.js` | NEW — 15 tests |
| `VERSION_3_VISION.md` | Category H added, Iteration 6/7 tables reshaped with rationale |

**Test status:** 90/90 passing (was 75) — 15 new TextSyncService tests added

**Build:** 300 KB (was 276 KB); gzipped 116 KB (was 109 KB) — +7 KB gzip for new services

**Deferred to Iteration 7:** E1 Coordinator Analytics Dashboard, D2 Visit Planner by City. Both documented in `VERSION_3_VISION.md` Section 6 with rationale.

---

### Iteration 5 — "The Know Release": Intelligence & Dashboard (2026-04-09)
**Status:** COMPLETE — ready to commit
**Scope:** 7 features delivering engagement intelligence, daily dashboard, interaction history, sync tracking, and data quality

**Feature D1: My Day Dashboard (new default home screen)**
- New `/dashboard` route as default home screen (replaces `/` visitor list)
- Sections: Today (birthdays/anniversaries), Overdue reminders, Follow-ups due, Needs Attention (lapsed visitors), Quick Stats (week summary), Data Quality
- Navigation reordered: Dashboard | Visitors | Reminders | History | Sync | Settings
- Legacy `/` route redirects to `/dashboard`

**Feature A1: Engagement Health Score**
- New `EngagementService.js` — calculates 0-100 score per visitor
- Score components: Recency (40%), Frequency (30%), Variety (15%), Depth (15%)
- Color-coded badges: Healthy (80+), Attention (50-79), At Risk (25-49), Lapsed (0-24)
- Displayed on VisitorList cards and VisitorView header
- Batch recalculation on dashboard load

**Feature A2: Lapsed Visitor Detection**
- `EngagementService.getLapsedVisitors()` with configurable threshold (default 60 days)
- Distinguishes "Was Active, Now Lapsed" from "Never Contacted"
- Excludes doNotContact and soft-deleted visitors
- Surfaced in Dashboard "Needs Attention" section

**Feature C3: Interaction History View**
- New `/interactions` route with global chronological list
- Filters: by type, outcome, volunteer (root only), date range, visitor name search
- Week stats header, pagination (50/page)
- Volunteer attribution column for root machines

**Feature F4: Sync Log + Known Machines**
- `StateManager.addSyncLogEntry()` and `StateManager.registerKnownMachine()`
- SyncService records import/export events automatically
- SyncManager UI shows sync history table (last 20 entries) and known machines grid
- `state.knownMachines` populated from sync metadata on every import

**Feature G3: Volunteer Attribution in UI**
- `StateManager.getMachineName(machineId)` resolves machine IDs to names
- VisitorView timeline shows "Logged by [volunteer name]" on each interaction
- InteractionHistory shows volunteer tag column for root machines

**Feature G4: Data Quality Indicator**
- `EngagementService.getDataQualityMetrics()` computes: % with phone, % with events, % with outcome
- Displayed as color-coded progress bars on Dashboard

**Files Changed:**
| File | Change |
|------|--------|
| `src/services/EngagementService.js` | NEW — Score calculation, lapsed detection, data quality metrics |
| `src/components/Dashboard/MyDayDashboard.js` | NEW — Default home screen with 6 sections |
| `src/components/Interactions/InteractionHistory.js` | NEW — Global interaction list with filters |
| `tests/engagement.test.js` | NEW — 19 tests for EngagementService |
| `src/core/state.js` | Added knownMachines, syncLog, getMachineName methods |
| `src/core/router.js` | Added DASHBOARD route, moved VISITORS to '/visitors' |
| `src/main.js` | Dashboard + InteractionHistory imports, nav reorder, default route change |
| `src/services/SyncService.js` | Sync log recording on import/export, knownMachines population |
| `src/components/Sync/SyncManager.js` | Sync history table, known machines display |
| `src/components/Visitors/VisitorView.js` | Engagement badge, last contact info, volunteer attribution in timeline |
| `src/components/Visitors/VisitorList.js` | Engagement score badge on visitor cards |
| `src/styles/main.css` | Dashboard, engagement, interaction history, data quality CSS |

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
- [x] Settings UI (reminder lookahead, preferences) — Iteration 3
- [x] GDPR consent mechanism on visitor creation — Iteration 4
- [x] Empty states, loading states, error boundaries — Iteration 3 (empty states done; loading/error boundaries deferred)
- [x] Native date inputs (replace triple-dropdown) — Iteration 3
- [x] Confirm dialogs for destructive actions (delete visitor) — Iteration 3
- [x] Replace native alert() with Toast notifications — Iteration 3
- [x] Dashboard with engagement scores and activity metrics — Iteration 5
- [x] CSV/PDF report export — Iteration 6 (CSV + text monthly report; PDF deferred to Iteration 7+)
- [x] WhatsApp-native text sync (H1) — Iteration 6 (bypasses file system entirely)
- [x] Smart contact frequency per visitor — Iteration 6
- [x] Full backup to text/file — Iteration 6
- [x] WhatsApp button externalisation fix — Iteration 6.6 (allowNavigation wildcard removed)
- [x] File sync works on mobile via share sheet — Iteration 7 Stage 0 (Web Share API for files)
- [x] Sync UX overhaul — single primary card, jargon stripped — Iteration 7 Stage B
- [x] ReminderDashboard density fix + native snooze dropdown — Iteration 7 Stage C
- [x] VisitorForm inline error placement + frequency toggle + autocomplete attrs — Iteration 7 Stage D
- [x] CSS token & touch-target hardening (WCAG AA, 44px) — Iteration 7 Stage A
- [ ] Coordinator analytics dashboard (charts) — deferred
- [ ] Visit planner by city — deferred
- [ ] Onboarding tour for first-time users
- [ ] Dashboard / VisitorView / VisitorList / InteractionHistory / Settings / Activation full redesigns — deferred to next iteration (Stage A token fixes already cleaned them up)
- [ ] Dark mode completion or removal — currently partial, deferred

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

### 7.7 ~~DoNotContact Flag Not Re-Checked at Communication Button Layer~~ (FIXED Iter 9.1)

~~The `Visitor.doNotContact` flag is correctly enforced at reminder *generation* but not at per-tile button click time.~~

**FIXED 2026-05-14 in Iter 9.1.** `InteractionLogger._blockedByDoNotContact()` is now called at the start of `quickAction()` and at the start of `openWhatsApp/openCall/openSMS/openEmail` (all four). VisitorView callsites updated to pass `visitorId` so the guard fires there too. Toast surfaces the block to the user.

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
> **We are in v3 development. The v3 plan is the law. Follow it.**

### Step 1: Understand Context
```
Read these files in order:
1. CLAUDE.md                    — Architecture, conventions, AND v3 development protocol
2. PROJECT_PLAN.md (this file)  — Iteration history, roadmap, known issues
3. VERSION_3_VISION.md          — v3 feature plan, iteration breakdown, data model changes
4. git log --oneline -10        — Recent changes
5. git status                   — Uncommitted work
```

### Step 2: Identify Current Iteration
- Look at Section 3 (Iteration History) for what was last completed
- Look at `VERSION_3_VISION.md` Section 6 (Iteration Plan) for what's next
- Cross-reference Section 6 (Enhancement Roadmap) here for phase-level tracking
- Check Section 7 (Known Issues) before starting new work

### Step 3: Read the Plan for This Iteration
- In `VERSION_3_VISION.md` Section 6, find the current iteration table
- Read every feature description referenced in that table (Sections 2-3)
- Read Section 4 (Data Model Changes) for model updates needed
- Read Section 5 (Technical Feasibility) for risks to watch for
- Read the Appendix (Files to Create/Modify) for the file list

### Step 4: Before Writing Code
- Read the actual source files you'll be modifying
- Verify the build works: `npx vite build`
- Confirm no uncommitted work from previous sessions

### Step 5: During Implementation
- Follow the iteration feature order (dependencies flow top-to-bottom)
- After each feature: run `npx vite build` to catch errors
- If the plan needs to change: update `VERSION_3_VISION.md` FIRST, then implement

### Step 6: After Completing an Iteration
- Update Section 3 here with the new iteration entry (files changed, features completed)
- Update Section 6 here with roadmap checkboxes
- Update `VERSION_3_VISION.md` Section 6: mark completed features, note scope changes
- Update Section 7 here if new issues were discovered
- Verify build: `npx vite build`
- **If anything was deferred or changed from the plan, document WHY in both files**

### Step 7: Handoff
- The next conversation starts at Step 1. Everything it needs is in these 3 documents.
- Never rely on memory from a previous conversation. The documents ARE the memory.

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
src/components/UI/ConfirmDialog.js     — Promise-based modal dialogs
src/components/Settings/SettingsPage.js — Settings page

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
