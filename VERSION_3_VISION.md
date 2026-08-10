# Dnyani Mitra v3.0 — Vision & Feature Roadmap (Reviewed)

> The jump from v2 to v3 is about transforming from a **contact database** into an **engagement intelligence system**. v2 stores visitor data. v3 tells you what to do with it.
>
> This document has been reviewed from 7 stakeholder perspectives, validated for technical feasibility, and audited for data flow correctness. All assumptions are documented and resolved.

---

## DEVELOPMENT PROTOCOL — READ THIS FIRST

**This document is the single source of truth for v3 development.** Every conversation, every iteration must follow this protocol.

### How to Use This Document

1. **Starting an iteration:** Read the Iteration Plan (Section 6). Find the current iteration. Read every feature listed in it by following the feature IDs (e.g., C1 → Section 3, Category C, Feature 1). Then read Section 4 (Data Model) and Section 5 (Technical Risks).

2. **During implementation:** Implement features in the order listed in the iteration table. If a feature depends on another (e.g., C2 depends on C1), do not skip ahead. If you discover something not in the plan, add it to this document BEFORE implementing.

3. **After completing an iteration:** Mark features as done in the iteration table below. If any feature was deferred or modified, add a note with the reason. Then update `PROJECT_PLAN.md` Section 3 with the iteration entry.

4. **If the plan needs to change:**
   - Scope addition: Add the feature to the appropriate category (A-G) with full description, add to the iteration table, document the reason.
   - Scope deferral: Move the feature to a later iteration in the table, document the reason.
   - Bug discovered: Add to Section 2 if critical, or to `PROJECT_PLAN.md` Section 7 if deferrable.
   - **Never silently skip or add features.** The plan is the contract.

### Implementation Rules (Non-Negotiable)

| Rule | Why |
|------|-----|
| Every reminder quick-action MUST also call `InteractionService.log()` | Section 2 documents the critical bug where reminder actions don't create interactions. This breaks analytics, timelines, and engagement scores. |
| Every new model field MUST have migration code in `StorageManager.migrateState()` | Without migration, existing users' apps crash on upgrade. See Section F3. |
| Every new model field MUST default to `null` or a safe value | Existing data in localStorage won't have the new field. Undefined access = crash. |
| `Interaction.createdBy` MUST always be set to current `machineId` | Volunteer attribution (G3) depends on this. Without it, coordinator can't track who did what. |
| `npx vite build` MUST pass after every feature | Catch import errors, syntax errors, and missing dependencies immediately. |
| WhatsApp links MUST use `91` country code prefix + normalized 10-digit phone | `normalizePhone()` in formatters.js strips to last 10 digits. Prefix `91` for India. |
| `DoNotContact` visitors MUST be excluded from reminders, lapsed detection, and communication buttons | Privacy requirement (G2). Check `visitor.doNotContact` in ReminderService and all action buttons. |

### Iteration Status Tracker

Mark each feature as it's completed. This is the live status board.

| Iter | Feature | Status | Notes |
|------|---------|--------|-------|
| 4 | FIX: Reminder actions create Interactions | DONE | Fixed in Iteration 4 |
| 4 | C1: Interaction Logger | DONE | Modal with full + quick modes |
| 4 | C2: Quick-log on reminders | DONE | Replaced dropdown with action buttons |
| 4 | B1: WhatsApp deep links | DONE | wa.me + template rendering |
| 4 | B2: One-tap Call/SMS/Email | DONE | tel:/sms:/mailto: everywhere |
| 4 | F1: Interaction types expansion | DONE | Added whatsapp, sms, meeting, donation |
| 4 | F2: Message templates | DONE | Template editor + variable substitution |
| 4 | G1: Consent capture | DONE | Checkbox + model fields |
| 4 | G2: Do Not Contact flag | DONE | Toggle + exclusion |
| 4 | F3: v2→v3 data migration | DONE | StorageManager migration code |
| 5 | D1: My Day Dashboard | DONE | Default home screen with 6 sections |
| 5 | A1: Engagement Health Score | DONE | EngagementService + visitor badges |
| 5 | A2: Lapsed Visitor Detection | DONE | Configurable threshold, never-contacted vs lapsed |
| 5 | C3: Interaction History View | DONE | /interactions route with filters + pagination |
| 5 | F4: Sync log + known machines | DONE | Auto-recorded on import/export |
| 5 | G3: Volunteer attribution in UI | DONE | Timeline + history show volunteer names |
| 5 | G4: Data quality indicator | DONE | Progress bars on dashboard |
| 6 | H1: WhatsApp-native text sync (copy-paste, Web Share) | DONE | Added 2026-04-14. TextSyncService with gzip+base64+CRC32, chunking, Web Share API. 15 unit tests. |
| 6 | E2: Text report export | DONE | ReportService + Reports card on MyDayDashboard. Text monthly summary + CSV. |
| 6 | E3: Enhanced per-visitor timeline | DONE | renderEngagementMeta() on VisitorView with frequency avg + next action. |
| 6 | A3: Smart contact frequency | DONE | VisitorForm Step 3 field + ReminderService._generateFrequencyReminder. ContactDue reminder type. |
| 6 | G5: Backup (text-first + file fallback) | DONE | Reshaped 2026-04-14. Dual-path in SyncManager (primary text, secondary file). Full state including settings. |
| 6.5 | Android deploy hardening | DONE | 2026-05-01. versionCode/Name from gradle vars, network_security_config, backup_rules, data_extraction_rules, file_paths root removed. |
| 6.6 | WhatsApp button externalisation hotfix | DONE | 2026-05-06. Removed `allowNavigation: ["*"]` from capacitor.config.json. WebView now hands wa.me to OS → App Links resolve to WhatsApp. |
| 7 | UX-1: Sync platform parity (file on mobile + text on laptop) | DONE | 2026-05-07. New `saveFile()` uses `navigator.share({files})` on Capacitor. `getSyncCapabilities()` helper labels best path per device. Backward-compat alias preserves existing callers. |
| 7 | UX-2: CSS tokens & primitives (WCAG AA, 44px touch) | DONE | 2026-05-07. `--color-text-secondary` → #4b5563, `--color-text-tertiary` → #6b7280, `.btn-sm` 44px, `.quick-action-btn` no-important, `.visitor-grid` min(), `.app-nav` clean wrap. |
| 7 | UX-3: SyncManager redesign | DONE | 2026-05-07. Single role-aware Send/Receive card + capability hint. "More options" collapsible. Jargon stripped. Single confirm verb. |
| 7 | UX-4: ReminderDashboard redesign | DONE | 2026-05-07. Filters collapsible. Tile compact. Snooze via native `<select>` (kills overlap bug). Sticky batch bar. |
| 7 | UX-5: VisitorForm redesign | DONE | 2026-05-07. Inline error placement. Frequency toggle. Category quick-pick chips. inputmode/autocomplete attrs. Family card less colorful. |
| 7 | E1: Coordinator Analytics Dashboard | **DEFERRED** | Deferred from Iteration 6 on 2026-04-14. Re-deferred. |
| 7 | D2: Visit planner by city | **DEFERRED** | Deferred from Iteration 6 on 2026-04-14. Re-deferred. |
| 7 | F-Notif: Local notifications | PENDING | |
| 7 | F-Contacts: Contact book import | PENDING | |
| 7 | B3: Post-communication auto-log | PENDING | |
| 7 | UX-6: Dashboard / VisitorView / VisitorList / InteractionHistory / Settings / Activation full redesigns | DEFERRED | Stage A token fixes already cleaned them up; full redesigns can wait until next iteration unless OEM testing surfaces issues. |
| 7 | UX-7: Dark mode complete or remove | **REMOVED (Iter 9.4)** | Resolved as *remove*. The partial dark theme (only neutral tokens flipped) caused invisible white-on-white text on dark-mode devices; removed the `@media (prefers-color-scheme: dark)` block + unused `.dark` class and forced `color-scheme: light`. A real dark theme would be a fresh planned iteration. See PROJECT_PLAN §3 Iter 9.4. |
| 8 | HOTFIX: WhatsApp deep-link navigation on Capacitor | DONE | 2026-05-12. Bug discovered after Iter 7: per-contact 💬 WhatsApp button did nothing / errored on APK; opened WhatsApp Web on desktop. RCA: `window.open('https://wa.me/…', '_blank')` routes through `WebChromeClient.onCreateWindow` which Capacitor doesn't externalise — Iter 6.6's removal of `allowNavigation: ["*"]` was necessary but not sufficient. Fix: new `InteractionLogger.openExternalUrl()` uses synthetic-anchor click on Capacitor (goes through `shouldOverrideUrlLoading` → `Intent.ACTION_VIEW`) and `window.open` on desktop. Same pattern already proven for tel:/sms:/mailto: in `_openProtocolLink`. Two call sites updated: `InteractionLogger.openWhatsApp`, `GreetingQueue` send button. versionCode bumped 2→3 / versionName 3.0.0→3.0.1 for install-over-install. |
| 10 | THE REACH RELEASE: Bulk Occasion Campaigns (user-manageable occasions + bilingual templates, SMS bulk + WhatsApp per-contact) + local notifications | DONE (code; device pending) | v3.1.0/vc10. Code-complete 2026-06-02 — 146 tests incl. render smoke + 3-agent adversarial review (all findings fixed). Occasions are a seeded + user-editable collection, each with its own MR/EN greeting & invitation templates; org tagline `चला जरा वेगळे जगुया ...` via `{tagline}` token. Every send logs an Interaction; DND always excluded, consent-only optional. Built on existing `SmsService.sendBulkNative` + `GreetingQueue` (extended backward-compatibly). Adds `state.occasions`/`state.campaigns` + idempotent forward-migration. **Detailed sequenced tasks: `ITERATION_10_PLAN.md`.** |
| 10.5 | REACH TAIL: B3 post-comm auto-log polish + F-Contacts phone-contact import | PLANNED | v3.1.1/vc11. Tail of the Reach release; see `ITERATION_10_PLAN.md`. |
| 11 | THE FIELD RELEASE: Visit Planner by City (lane D2) | PLANNED | v3.2.0/vc12. Group active visitors by city, per-city field-round view (upcoming events + lapsed), mark-visited → visit Interaction. Offline, no map tiles. Task sketch in `ITERATION_10_PLAN.md`. |
| 12 | THE POLISH RELEASE: Design-language elevation (UX-6 screen set) | PLANNED | v3.3.0/vc13. Driven by `frontend-design`; coherent tokens, Devanagari type scale, polished states, a11y. Task sketch in `ITERATION_10_PLAN.md`. |
| 9.5 | POLISH: Branding (Sewa Sankalp launcher icon + "Dnyani Mitr" name) + button-overlap fix | DONE | 2026-06-02. Owner reported v3.0.6 working on real devices (incl. Oppo + Redmi), with three ship asks. (1) Launcher icon → regenerated all 5-density `ic_launcher*`/`ic_launcher_foreground` PNGs from the Sewa Sankalp **emblem** (figures + hands; Marathi text cropped as illegible at icon size), offline via PIL. (2) Display name → "NGO Mitr" → **"Dnyani Mitr"** in `strings.xml` (app_name/title), `capacitor.config.json`, `manifest.json`, `index.html` title, `constants.APP_NAME`, and the SMS-permission instruction text (appId unchanged for upgrade path). (3) Button overlap RCA: global `.btn{white-space:nowrap}` + flex rows with `min-width` floors → on OEM large-font scale (MIUI/ColorOS) labels overflowed their box onto neighbours (Reminders WhatsApp/SMS/Called/Visited; same class in VisitorView/Sync/Settings). Fix: `.btn-sm{white-space:normal; line-height:1.2}` + `@media(max-width:380px)` font step — labels wrap instead of overflow, fixing every flow at once. Also fixed a pre-existing IST-midnight timezone flake in `formatters.test.js`. 111/111 pass, build + cap sync clean. v3.0.6 → v3.0.7 (versionCode 8→9). Device retest pending: icon+name visible, no overlap (incl. Large system font). |
| 9.4 | FIX: Force-light theme — remove accidental dark mode (contrast/readability) | DONE | 2026-05-26. v3.0.5 device test on dark-mode phones: Add Visitor inputs invisible while typing (white-on-white) + Reminder visitor names invisible. RCA: a `@media (prefers-color-scheme: dark)` block in `variables.css` flipped 7 neutral tokens, but ~149 hard-coded light-only color literals didn't flip → token text went near-white on hard-coded white backgrounds; `.form-input:focus` also hard-coded `#ffffff`. Fix: removed the dark media query + unused `.dark` class, added `color-scheme: light` (`:root` + `<meta>`), `.form-input:focus` bg → `var(--color-surface)`. App locked to designed light theme on web + all OEM WebViews. Resolves UX-7 (as *remove*) + Known Issue 7.1. 111/111 pass, build clean, cap sync clean. v3.0.5 → v3.0.6 (versionCode 7→8). Device-retest on a dark-mode phone still pending. |
| 9.3 | FIX: Reminders "Show month" view reveals handled state | DONE | 2026-05-15. Default Reminders view correctly hides snoozed/contacted-this-cycle items; the "Show &lt;month&gt;" escape-hatch had no equivalent filter, so it re-surfaced handled items invisibly — user reasonably read this as a bug in the default view. Fix: `getRemindersForMonth` now annotates each Reminder with `handled`/`handledReason`/`handledAt`/`handledUntil` (reusing `isSnoozed` + `_isAlreadyContactedThisCycle`); `renderTile` dims handled cards (opacity 0.65) and adds a "✓ Contacted &lt;date&gt;" or "💤 Until &lt;date&gt;" pill. Sort: unhandled first. Action buttons stay enabled. 6 new tests (111/111 pass). v3.0.4 → v3.0.5 (versionCode 6→7). |
| 9.2 | FIX: Sync metadata round-trip (sender machine attribution) | DONE | 2026-05-15. `SyncManager.performImport` passed `pendingImport.data` to `merge`, but `merge` reads metadata at the top level → every WhatsApp-text and file import silently dropped sender `machineId`/`machineName`/`dataVersion`. Sync log showed "Unknown" sender; `knownMachines` panel stayed empty. Fix: `merge` now unwraps both shapes (`{metadata, data}` and flat); SyncManager passes the whole package. 2 regression tests added (105/105 pass). v3.0.3 → v3.0.4 (versionCode 5→6). Visitor/interaction merge untouched — bug was audit-trail only. |
| 9 | B4: Native bulk SMS plugin + WhatsApp demotion | DONE | 2026-05-14. Added because the WhatsApp deep-link path (Iter 6.6 + Iter 8) is OEM-fragile and the volunteer fleet needs a reliable bulk-greeting channel. New `SmsPlugin.java` exposes `SmsManager.sendTextMessage()` to JS via Capacitor bridge; new `SmsService.sendBulkNative()` paces 1.5s/msg, logs Interactions, marks Reminders. New `SmsBatchQueue` UI mirrors GreetingQueue with blue palette. Bulk SMS button is primary on ReminderDashboard batch bar + MyDayDashboard Today section (Capacitor only); WhatsApp button demoted from primary to secondary but kept fully functional. Per-contact 📱 SMS button added to reminder tiles (uses existing `sms:` URI). Settings page has new SMS permission panel. Zero data model changes; zero migration code; 12 new unit tests. v3.0.1 → v3.0.2 (versionCode 3→4). Iter 8 + Iter 9 ship together as one APK. |

---

## Table of Contents

1. [The Core Problems v2 Doesn't Solve](#1-the-core-problems-v2-doesnt-solve)
2. [Critical Data Flow Bug to Fix First](#2-critical-data-flow-bug-to-fix-first)
3. [Feature Catalog (A-G)](#3-feature-catalog)
4. [Data Model Changes](#4-data-model-changes)
5. [Technical Feasibility & Risks](#5-technical-feasibility--risks)
6. [Iteration Plan](#6-iteration-plan)
7. [Stakeholder Coverage Matrix](#7-stakeholder-coverage-matrix)
8. [Success Metrics](#8-success-metrics)

---

## 1. The Core Problems v2 Doesn't Solve

v2 answers: *"Who are our visitors and when are their birthdays?"*
v3 must answer: *"Who should I contact today, what should I say, and how do I do it in one tap?"*

**The daily reality of an NGO field worker today (v2):**
1. Opens app → sees visitor list (not reminders) → must navigate manually
2. Clicks "Log Interaction" → gets a browser `prompt()` box → types a note
3. Interaction is **hardcoded as "call"** — no way to pick type, set date, or schedule follow-up
4. Clicks "WhatsApp" on a reminder tile → records a reminderAction but **does NOT create an Interaction** → timeline stays empty, analytics miss it
5. Goes to WhatsApp manually → searches for the contact → types a birthday message from scratch
6. No idea which visitors they haven't contacted in months
7. No idea if their efforts are actually working
8. Coordinator receives 10 sync files per week but **can't see which volunteer did what**

---

## 2. Critical Data Flow Bug to Fix First

### BUG: Reminder Actions Don't Create Interactions

**Current flow when volunteer clicks "WhatsApp" on a reminder tile:**
```
1. Dropdown change → val = 'call_whatsapp'
2. prompt('Add a quick note (optional):', 'Action taken via Dashboard')
3. ReminderService.recordAction(id, 'contacted', 'call_whatsapp: note')
4. Creates reminderAction: { action: 'contacted', note: 'call_whatsapp: ...' }
5. DOES NOT call InteractionService.log()
```

**Impact:**
- VisitorView timeline shows **nothing** — interactions array unchanged
- Analytics/engagement scores will **ignore** all reminder-based actions
- Coordinator sees "0 interactions" for a volunteer who actually wished 50 birthdays
- The `createdBy` (machineId) field on interactions is never set for reminder actions

**This MUST be fixed in Iteration 4 before any other v3 feature.** Every quick-action on a reminder tile must also create an Interaction record.

---

## 3. Feature Catalog

### A. Engagement Intelligence (The Brain)

#### A1. Engagement Health Score
**Problem:** All visitors look equal. A coordinator can't tell who's being neglected.

**Solution:** Auto-calculated score per visitor (0-100):
- **Recency** — days since last interaction (40% weight)
- **Frequency** — interactions per quarter vs target (30% weight)
- **Variety** — mix of interaction types (15% weight)
- **Depth** — family members known, events tracked (15% weight)

**Visual:** Color-coded badge on visitor cards:
- Green (80-100): Healthy
- Yellow (50-79): Attention needed
- Orange (25-49): At risk
- Red (0-24): Lapsed

**Implementation:**
- New `EngagementService.js` — pure computation, no new state
- Score cached on visitor object (`engagementScore`, `engagementUpdatedAt`)
- Recalculated: on interaction log (single visitor) + on app open (batch, chunked)
- Sortable/filterable on VisitorList
- Performance: 1000 visitors × 5000 interactions = ~50-100ms on modern Android

**Edge cases:**
- New visitor with zero interactions → score = 0 (red), expected behavior
- Visitor with only 1 interaction ever → low score even if recent (frequency component pulls it down)
- Score must exclude soft-deleted visitors

#### A2. Lapsed Visitor Detection
**Problem:** Volunteers manage 200+ contacts. Some silently fall through the cracks.

**Solution:** Auto-generated "Needs Attention" section on dashboard:
- Visitors with no interaction in X days (default 60, configurable in Settings)
- Sorted by days-since-last-contact (worst first)
- Shows last interaction date, type, and volunteer who logged it
- One-tap "Contact Now" action buttons

**Implementation:**
- Extend `ReminderService.generateReminders()` to also scan interaction dates
- New urgency category: `lapsed`
- Setting: `lapseThresholdDays` (default 60)

**Edge cases:**
- Visitor with zero interactions ever → always "lapsed" from day 1. Show separately as "Never Contacted" to distinguish from "Was Active, Now Lapsed"
- Visitor marked "Do Not Contact" → exclude from lapsed detection
- Soft-deleted visitors → exclude

#### A3. Smart Contact Frequency
**Problem:** Different visitors need different attention levels.

**Solution:** Per-visitor "Contact every X days" target:
- Set on VisitorForm Step 3 or inline on VisitorView
- When interval passes without interaction → auto-reminder generated
- Combines with Engagement Score (frequency target met = green)

**Data model:** `Visitor.contactFrequencyDays: number | null` (null = no target)

**Edge cases:**
- If target is 30 days and last interaction was 25 days ago → no reminder yet
- If target is 30 days and last interaction was 35 days ago → reminder appears
- If visitor has no interactions → reminder appears immediately

---

### B. One-Tap Communication (The Hands)

#### B4. Native Bulk SMS (Iter 9 addition)
**Added 2026-05-14** after owner reported the WhatsApp path felt unreliable across OEMs and asked for a concrete, working bulk SMS option for birthday + anniversary greetings.

**Problem:** Per-contact `sms:` URI works everywhere but requires one tap per contact in the system SMS app. For 30 birthdays = 30 manual sends. WhatsApp bulk (Iter 4 + 6.6 + 8) had per-OEM uncertainty.

**Solution:** Hybrid path with automatic fallback.
- **Native (Capacitor + SEND_SMS granted):** `SmsPlugin.java` calls `SmsManager.sendTextMessage()` per contact, paced 1.5s/msg. Truly one-tap for the whole batch.
- **Protocol (everywhere else):** falls back to existing per-contact `sms:` URI via `InteractionLogger.openSMS()`. Already worked; no new path needed.

**Why this works for an NGO context:**
- Sender is the volunteer's own number — personal touch.
- Free / on-plan SMS — no API costs, no gateway dependency.
- P2P SMS from personal SIMs is exempt from TRAI DLT registration (which applies to bulk gateway senders).
- Offline-first (uses cellular).
- No Play Store policy issue — app is sideloaded.

**Files:**
- `android/.../SmsPlugin.java` — Capacitor plugin with `checkPermission`, `requestPermission`, `sendSms`.
- `src/services/SmsService.js` — capability detection + bulk send orchestration.
- `src/components/UI/SmsBatchQueue.js` — UI modal (intro / sending / done phases).

**Implementation rule:** every successful SMS send (native or protocol) MUST create an Interaction record + mark the Reminder, same as every other quick-action in v3.

#### B1. WhatsApp Deep Links with Pre-Composed Messages
**Problem:** 10 birthdays/day × 5 minutes each = 50 minutes wasted on manual WhatsApp.

**Solution:** "Send Wish" button opens WhatsApp with pre-composed message:
- Link format: `https://wa.me/91${normalizedPhone}?text=${encodeURIComponent(message)}`
- Message templates configurable in Settings (see F3)
- Button on: Reminder tiles, VisitorView, Daily Dashboard

**Technical validation (FEASIBLE):**
- Works in Capacitor WebView with `androidScheme: "https"` and `allowNavigation: ["*"]`
- Works offline (WhatsApp queues the message)
- URL length limit: ~2048 chars (template messages stay well under)
- WhatsApp Business and regular WhatsApp both accept `wa.me` links
- Country code required: use `91` prefix (India) — strip leading 0 from phone

**Fallback if WhatsApp not installed:**
- Android shows "No app found" — catch this and offer SMS fallback
- Implementation: wrap in try-catch, fallback to `sms:${phone}?body=${message}`

**Phone number handling:**
- Use existing `normalizePhone()` from formatters.js (strips non-digits, takes last 10)
- Prepend `91` for Indian numbers
- If phone < 10 digits → disable WhatsApp button, show "Phone number incomplete"

#### B2. One-Tap Call, SMS & Email
**Problem:** Phone numbers displayed but not actionable in most places.

**Solution:** Consistent action buttons everywhere:
- Call: `tel:${phone}` (no plugin needed, works in WebView)
- SMS: `sms:${phone}?body=${message}` (no plugin needed)
- Email: `mailto:${email}?subject=${subject}&body=${body}` (no plugin needed)
- WhatsApp: `https://wa.me/91${phone}` (no plugin needed)

**Where:** VisitorView contact details, Reminder tiles, VisitorList cards, Daily Dashboard

**Edge cases:**
- No phone → hide call/SMS/WhatsApp buttons
- No email → hide email button
- Multiple phones → use first phone (phones[0]) for action buttons, show all in detail view

#### B3. Post-Communication Auto-Log
**Problem:** Volunteer calls someone, forgets to log the interaction.

**Solution:** When user taps Call/WhatsApp/SMS action:
1. Store pending action in localStorage: `{ type, visitorId, phone, timestamp }`
2. Open communication channel (tel:/wa.me/sms:)
3. On app resume (`visibilitychange` event), if pending action exists and < 10 minutes old:
   - Show InteractionLogger pre-filled with type and visitor
   - User confirms with one tap or adds notes
4. If app was killed (OEM aggressive memory management):
   - On next app start, check for pending action
   - Show "Did you complete this interaction?" prompt

**Technical validation (CAUTION):**
- `visibilitychange` is unreliable on Xiaomi/Oppo WebViews
- Mitigation: persist pending state to localStorage, check on app start
- Timer-based approach (30 seconds) replaced with resume-based approach (more reliable)
- If user dismisses → clear pending action, don't nag

---

### C. Proper Interaction Logging (The Memory)

#### C1. Full Interaction Logger Component
**Problem:** `prompt()` with hardcoded "call" type is the #1 UX failure.

**Solution:** New `InteractionLogger` component — modal/slide-up panel:

**Full mode fields:**
- **Type** dropdown: Call, Visit, WhatsApp, SMS, Email, Letter, Meeting, Other
- **Date** (default: today, editable via native date input)
- **Outcome** select: Successful, No Answer, Busy, Rescheduled, Left Message, Other
- **Notes** textarea (optional)
- **Follow-up** toggle → date picker + notes for next action
- **Duration** (optional, minutes)

**Quick mode (one-tap buttons):**
- "Called" → type=call, outcome=successful, date=today
- "Wished via WhatsApp" → type=whatsapp, outcome=successful, date=today
- "Visited" → type=visit, outcome=successful, date=today
- "Called - No Answer" → type=call, outcome=no_answer, date=today
- Each quick button creates the interaction immediately, shows Toast confirmation

**Where used:**
- VisitorView "Log Interaction" button → opens full mode
- Reminder tile quick actions → uses quick mode
- Post-communication auto-log → opens pre-filled full mode
- Daily Dashboard action buttons → uses quick mode

**Data model changes:**
```
Interaction (add fields):
  + outcome: string       // 'successful' | 'no_answer' | 'busy' | 'rescheduled' | 'left_message' | 'other'
  + duration: number|null // minutes
  + followUpDate: string|null  // ISO date
  + followUpNotes: string      // what to do next
```

**Critical requirement:** Every interaction must set `createdBy` to current `machineId` (already exists in model, but VisitorView prompt flow passes null for contactId — fix this).

#### C2. Quick-Log on Reminder Tiles (Replaces Dropdown)
**Problem:** Current flow: dropdown → prompt → type note → 3 steps minimum.

**Current broken flow (to replace):**
```
select "WhatsApp" → prompt() → ReminderService.recordAction() → NO Interaction created
```

**New flow:**
```
tap "Wished" button → InteractionService.log(visitorId, 'whatsapp', 'Birthday wish sent', ...)
                     + ReminderService.recordAction(reminderId, 'contacted', ...)
                     → Toast "Wished via WhatsApp!"
```

**Buttons per tile:**
- "WhatsApp Wish" → opens WhatsApp deep link (B1) + logs interaction + marks reminder
- "Called" → logs call interaction + marks reminder
- "Visited" → logs visit interaction + marks reminder
- "Snooze" → expandable: 1 day / 3 days / 7 days / custom
- "..." more → opens full InteractionLogger (C1)

**Snooze improvements:**
- Current: hardcoded 7 days, no choice
- New: 1 day, 3 days, 7 days, custom (date picker)

#### C3. Interaction History View
**Problem:** Interactions only visible per-visitor in timeline. No global view.

**Solution:** New `/interactions` route:
- Chronological list of all interactions across all visitors
- Visitor name + type + outcome + date + notes
- Filters: by type, by date range, by visitor name, by outcome, by volunteer (machineId)
- Stats header: "This week: 12 calls, 5 visits, 8 WhatsApp"
- Pagination (50 per page)

**For coordinators (root machine):** Shows `createdBy` as volunteer machine name

---

### D. Daily Action Plan (The Guide)

#### D1. "My Day" Dashboard
**Problem:** App opens to visitor list. Morning question is: "What do I need to do today?"

**Solution:** New default home screen:

**Section 1: "Today" card**
- Birthdays, anniversaries, death anniversaries for today
- Each with one-tap WhatsApp wish button + quick-log

**Section 2: "Overdue" card**
- Reminders past their date, sorted by days overdue
- Red urgency indicator

**Section 3: "Follow-ups Due" card**
- Interactions with `followUpDate <= today`
- Shows original interaction notes + follow-up notes
- One-tap action buttons

**Section 4: "Needs Attention" card (if Iteration 5 complete)**
- Top 5 lapsed visitors (longest gap since last contact)
- Shows days since last contact

**Section 5: "Quick Stats" banner**
- "This week: X contacted, Y reminders completed, Z pending"
- Computed from interactions + reminderActions in the past 7 days

**Navigation change:**
- Default route changes from `/` (VisitorList) to `/dashboard`
- VisitorList moves to `/visitors`
- Nav order: Dashboard | Visitors | Reminders | Data/Sync | Settings

#### D2. Visit Planner by City
**Problem:** Field volunteer has contacts in 5 cities. Random visiting is inefficient.

**Solution:** Enhanced filter mode on VisitorList:
- New filter: "Has pending reminder" checkbox
- Group-by-city toggle: shows visitors grouped under city headers
- "Select for visit" checkboxes → selected contacts form a visit list
- "Log Visit for Selected" → bulk-creates visit interactions for all checked visitors

---

### E. Analytics & Reporting (The Eyes)

#### E1. Coordinator Analytics Dashboard
**Solution:** New `/analytics` route:

**Charts (vanilla JS canvas/SVG, no library):**
- Visitor Growth: bar chart, new visitors per month (last 12 months)
- Interaction Trends: stacked bar chart, interactions per week by type
- Category Breakdown: horizontal bar chart, visitors by category

**Tables:**
- City Coverage: city | visitor count | interactions this month | last activity date
- Neglected Visitors: visitors with 0 interactions in 90+ days
- Volunteer Activity (root only): machine name | last sync | interactions logged this month

**Note on volunteer tracking:** `Interaction.createdBy` already stores `machineId`. The coordinator (root) can map machineId to machineName via sync package metadata. This requires storing a `knownMachines` map in state (populated during each import from `metadata.machineId` + `metadata.machineName`).

#### E2. Text Report Export (WhatsApp-Friendly)
**Solution:** "Copy Report" button generates text summary:
```
Monthly Report — March 2026
Sewa Sankalp Pratishthan
────────────────────────
Active Visitors: 234
New This Month: 12
Interactions: 89 (34 calls, 28 visits, 27 WhatsApp)
Reminders Completed: 45/52 (87%)
Visitors Needing Attention: 18
Top Cities: Pune (45), Mumbai (32), Nashik (28)
────────────────────────
Generated by Dnyani Mitra v3.0
```
Copies to clipboard → volunteer pastes into WhatsApp group.

Also: CSV export of visitor list + interaction counts for spreadsheet analysis.

#### E3. Enhanced Per-Visitor Timeline
**Solution:** On VisitorView, add above timeline:
- Engagement score badge (color-coded)
- "Last contact: 23 days ago (WhatsApp)" with color
- "Contact frequency: ~every 15 days" (calculated average)
- "Next: Follow-up due Mar 30" or "Birthday in 5 days"

---

### F. Data & Platform Improvements (The Foundation)

#### F1. Interaction Types Expansion
**Current:** call, visit, email, letter, other
**Add:** whatsapp, sms, meeting, donation

**Constants change:**
```javascript
INTERACTION_TYPES = {
  CALL: 'call', VISIT: 'visit', EMAIL: 'email', LETTER: 'letter',
  WHATSAPP: 'whatsapp', SMS: 'sms', MEETING: 'meeting', DONATION: 'donation', OTHER: 'other'
}
INTERACTION_TYPE_LABELS = {
  call: '📞 Call', visit: '🏠 Visit', email: '📧 Email', letter: '✉️ Letter',
  whatsapp: '💬 WhatsApp', sms: '📱 SMS', meeting: '🤝 Meeting', donation: '🎁 Donation', other: '📋 Other'
}
INTERACTION_OUTCOMES = {
  SUCCESSFUL: 'successful', NO_ANSWER: 'no_answer', BUSY: 'busy',
  RESCHEDULED: 'rescheduled', LEFT_MESSAGE: 'left_message', OTHER: 'other'
}
```

#### F2. Message Templates
**Solution:** Templates stored in `settings.messageTemplates`:
```javascript
{
  birthday: "Happy Birthday {name}! Warm wishes from {org}. 🎂",
  anniversary: "Happy Anniversary {name}! Wishing you many more years together. 💍",
  deathAnniversary: "Remembering your loved one today, {name}. Our thoughts are with you. 🙏",
  followUp: "Hi {name}, following up on our last conversation. How can we help? — {volunteer}",
  thankYou: "Thank you {name} for your generous support of {org}! 🙏"
}
```
Variables: `{name}` (contact name), `{org}` (ORGANIZATION constant), `{volunteer}` (machineName), `{date}` (event date formatted)

Default templates pre-loaded. Editable in Settings. Synced in export package under `data.settings.messageTemplates`.

#### F3. v2→v3 Data Migration
**Problem:** v3 adds new fields. What happens on mixed-version sync?

**v3 imports v2 data:** Missing fields become defaults:
- `outcome` → `null` (not "other" — null means "pre-v3 interaction, outcome unknown")
- `duration` → `null`
- `followUpDate` → `null`
- `contactFrequencyDays` → `null`
- `engagementScore` → `0` (recalculated on first load)

**v2 imports v3 data:** New fields are silently dropped by v2's JSON parse. No data corruption, but v3 fields lost on round-trip through v2 machine.
- Mitigation: show warning in SyncManager when importing from lower version
- Store `dataVersion: '3.0'` in sync package metadata

**State migration on app upgrade:**
```javascript
// In StorageManager.migrateState()
if (state.version < '3.0.0') {
  state.interactions = state.interactions.map(i => ({
    ...i,
    outcome: i.outcome || null,
    duration: i.duration || null,
    followUpDate: i.followUpDate || null,
    followUpNotes: i.followUpNotes || ''
  }));
  state.visitors = state.visitors.map(v => ({
    ...v,
    contactFrequencyDays: v.contactFrequencyDays || null,
    engagementScore: 0,
    engagementUpdatedAt: null
  }));
  state.settings = {
    ...state.settings,
    lapseThresholdDays: state.settings?.lapseThresholdDays || 60,
    messageTemplates: state.settings?.messageTemplates || DEFAULT_MESSAGE_TEMPLATES
  };
  state.knownMachines = state.knownMachines || {};
  state.version = '3.0.0';
}
```

#### F4. Sync Enhancements
- **Sync log:** Record each import/export: `{ timestamp, machineId, machineName, direction, visitorsAdded, visitorsUpdated, interactionsAdded }`
- Stored in `state.syncLog` array (keep last 50 entries)
- Visible in SyncManager UI: "Last synced with Priya's Phone on Mar 26 at 2:30 PM"
- **Known machines map:** `state.knownMachines = { machineId: machineName }` — populated from sync metadata on every import

---

### G. Trust & Governance (The Shield) — NEW CATEGORY

*Identified from stakeholder review. Not in original vision. Critical for adoption.*

#### G1. Consent Capture
**Problem:** No record that volunteer has permission to store visitor's data.

**Solution:** Checkbox on VisitorForm Step 1:
- "I have permission to store this person's contact information"
- Must be checked to proceed (validation)
- Stored: `Visitor.consentGiven: boolean`, `Visitor.consentDate: string` (ISO)
- Displayed on VisitorView as info badge

**Data model:** Add to Visitor: `consentGiven`, `consentDate`

#### G2. Do Not Contact Flag
**Problem:** No way for a visitor to opt out of communication.

**Solution:**
- Toggle on VisitorView: "Do Not Contact"
- When enabled: no reminders generated, communication buttons disabled, visitor excluded from lapsed detection
- Visual: grey/muted visitor card with "Do Not Contact" badge
- Stored: `Visitor.doNotContact: boolean`

#### G3. Volunteer Attribution & Sync Tracking
**Problem:** Coordinator can't see "who did what" or "who synced when".

**Solution (already mostly exists, just underexposed):**
- `Interaction.createdBy` already stores `machineId` — surface this in:
  - Interaction History View (C3): show volunteer name column
  - Analytics (E1): volunteer activity breakdown
  - VisitorView timeline: "Logged by Priya's Phone"
- `state.knownMachines` map: populated from sync imports
- Sync log (F4): visible on SyncManager page

#### G4. Data Quality Indicator
**Problem:** Coordinator can't tell how complete their data is.

**Solution:** Light data quality metrics on Analytics page:
- % of visitors with phone number
- % of visitors with at least one event date (birthday/anniversary)
- % of interactions with outcome recorded (v3 field)
- Top "incomplete" visitors (missing phone or events)

No new data model — computed from existing fields.

#### G5. Backup (Text-First + File Fallback)
**Problem:** If phone breaks, all data is lost. Pre-sync backup is only in localStorage. Files shared on WhatsApp often can't be re-opened after download (see H1).

**Solution (reshaped 2026-04-14):** "Full Backup" panel on SyncManager with TWO paths:
- **Primary — Copy to clipboard** (uses H1 text-sync format): includes ALL data (visitors, interactions, reminderActions, settings, syncLog). User pastes into WhatsApp self-chat or email to self. Works on any device regardless of storage permission.
- **Secondary — Download as file** (for desktop users): same payload, .json file
- Restore: text paste (primary) or file select (fallback) via existing import mechanism with `restoreMode: true` flag that also restores settings + reminderActions

---

### H. WhatsApp-Native Operations (The Reality Check) — NEW CATEGORY

*Added 2026-04-14 after user feedback. The single biggest adoption blocker across all iterations so far: sync files shared on WhatsApp become inaccessible after download on many Android devices (MIUI, ColorOS, OneUI) due to Scoped Storage (Android 11+), SAF permission quirks, and downloads landing in app-private folders the import picker can't see.*

*The file-based sync model is NOT broken — the Android file system behaviour is hostile. The fix is to make file transfer optional, not mandatory.*

#### H1. WhatsApp-Native Text Sync (THE Core Feature)
**Problem:** Every iteration has fixed file-sharing bugs (BOM handling, paste fallback, file picker fallbacks) but the underlying issue — that a file downloaded from WhatsApp is often unreachable to the app — cannot be fixed at the app layer.

**Solution: Skip files entirely. Use text messages.**

**Export flow:**
1. User taps "Share via Text" on Sync page
2. App generates a compact text blob wrapped in recognizable markers (`====DM-SYNC v1====`)
3. Blob contains:
   - Metadata line: machine name, role, export time, CRC32 checksum, chunk count
   - Payload: base64-encoded, gzip-compressed JSON of `{metadata, data}`
   - Same shape as existing JSON sync package — re-uses `SyncService.merge()`
4. Two actions offered:
   - **Copy to clipboard** (universal) → user pastes into WhatsApp chat
   - **Share to WhatsApp directly** (Web Share API `navigator.share({text})`) → opens Android share sheet, pre-filled, user picks WhatsApp contact/group
5. If payload exceeds comfortable paste size (~40,000 chars), app splits into numbered chunks. Each chunk is its own WhatsApp message. User sends chunks in order.

**Import flow:**
1. User taps "Paste from Text" on Sync page
2. Large textarea appears, placeholder: "Paste the shared message(s) here"
3. User pastes one chunk (or all chunks at once)
4. App parses, validates CRC32, decompresses, shows preview (same as file import)
5. If chunks missing: shows "Waiting for chunk 3 of 5 — paste next message"
6. Once complete, user confirms → merge via existing `SyncService.merge()` → done

**Technical design:**
- Compression: `CompressionStream('gzip')` API (Chrome 80+, Android WebView 80+, Node 18+)
  - Fallback if unavailable: raw base64 (larger, but still works)
- Checksum: CRC32 (pure JS, ~10 lines, no deps) — catches paste corruption
- Format resilient to: surrounding WhatsApp metadata (timestamps, sender names), extra whitespace, BOM, line-ending variation
- Chunk format: `====DM-SYNC v1 1/5====` + payload + `====END 1/5====` — regex parser tolerates noise between markers
- Max chunk size: 3500 chars (safe for Android keyboards and WhatsApp paste behaviour)
- All existing file-based sync paths kept intact — text sync is additive, not replacement

**Coverage goals:**
- 100 visitors + 300 interactions → fits in single WhatsApp message
- 500 visitors + 2000 interactions → 5-6 chunks, still workable
- If user has 5000+ visitors → warn "Consider file export to desktop" (they're the outlier)

**Why this is the right fix (not more file-handling bugs):**
- WhatsApp text messages work on every Android device, every version, every OEM skin — no Scoped Storage issues, no SAF permissions, no DocumentsUI quirks
- Users already know how to copy/paste in WhatsApp
- Works for Satellite → Satellite (peer) the same as Root → Satellite
- Offline-compatible (WhatsApp queues messages)

#### H2. Share Intent Wiring
Use `navigator.share({text, title})` for the "Share" button to open Android's native share sheet. Feature-detected; falls back to clipboard copy + instruction toast when unavailable (older WebView, desktop without Web Share).

---

## 4. Data Model Changes

### Visitor (existing + new fields)
```
+ consentGiven: boolean          // G1: default false
+ consentDate: string | null     // G1: ISO date when consent recorded
+ doNotContact: boolean          // G2: default false
+ contactFrequencyDays: number | null  // A3: target days between contacts
+ engagementScore: number        // A1: calculated 0-100, default 0
+ engagementUpdatedAt: string | null   // A1: last calculation timestamp
```

### Interaction (existing + new fields)
```
+ outcome: string | null         // C1: null for pre-v3, 'successful' | 'no_answer' | 'busy' | 'rescheduled' | 'left_message' | 'other'
+ duration: number | null        // C1: minutes
+ followUpDate: string | null    // C1: ISO date for follow-up
+ followUpNotes: string          // C1: what to do next, default ''
```
Note: `createdBy` already exists (machineId). Ensure all code paths set it.

### State (new top-level fields)
```
+ knownMachines: { [machineId]: machineName }  // F4: populated from sync
+ syncLog: Array<{ timestamp, machineId, machineName, direction, stats }>  // F4: last 50
+ version: string                // F3: '3.0.0'
```

### Settings (new fields)
```
+ lapseThresholdDays: number     // A2: default 60
+ messageTemplates: {            // F2
    birthday: string,
    anniversary: string,
    deathAnniversary: string,
    followUp: string,
    thankYou: string
  }
```

### Constants (new)
```
INTERACTION_TYPES += whatsapp, sms, meeting, donation
INTERACTION_OUTCOMES: successful, no_answer, busy, rescheduled, left_message, other
ENGAGEMENT_THRESHOLDS: { healthy: 80, attention: 50, atRisk: 25 }
DEFAULT_MESSAGE_TEMPLATES: { birthday: '...', anniversary: '...', ... }
```

---

## 5. Technical Feasibility & Risks

| Feature | Status | Key Risk | Mitigation |
|---------|--------|----------|------------|
| WhatsApp deep links | FEASIBLE | WhatsApp not installed | Fallback to SMS |
| tel:/sms:/mailto: | FEASIBLE | None | Standard HTML, no plugin |
| localStorage capacity | CAUTION | ~2MB at 1000 visitors + 5000 interactions | Monitor usage; lazy-load old interactions; IndexedDB in v4 |
| Engagement score calc | FEASIBLE | CPU on batch recalc | Cache on visitor + incremental updates |
| Local notifications | CAUTION | OEM battery optimization kills notifications | User whitelist guide in Settings |
| Contact book import | CAUTION | Phone format inconsistency | Robust parsing + runtime permissions |
| Post-comm auto-log | CAUTION | `visibilitychange` unreliable on Xiaomi/Oppo | Persist pending state to localStorage; check on app start |
| Build size | FEASIBLE | ~300KB (from 205KB) | Well within single-file limits |
| v2/v3 sync compat | CAUTION | v2 drops v3 fields | Migration code + version warning in SyncManager |
| Offline | FEASIBLE | All features work offline | No external API calls |
| Vanilla JS charts | FEASIBLE | No chart library | Canvas/SVG + simple bar/line charts |

---

## 6. Iteration Plan

### Iteration 4: "The Do Release" — Communication & Action
**Theme:** Make every reminder actionable in one tap

| # | Feature | Effort | Notes |
|---|---------|--------|-------|
| **FIX** | Reminder actions must also create Interactions | Low | Critical bug fix before anything else |
| C1 | Interaction Logger component (replace prompt()) | Medium | Modal with full + quick modes |
| C2 | Quick-log buttons on reminder tiles | Low | Replace dropdown with action buttons |
| B1 | WhatsApp deep links | Low | wa.me + template rendering |
| B2 | One-tap Call/SMS/Email | Low | tel:/sms:/mailto: links everywhere |
| F1 | Interaction types expansion | Low | Add whatsapp, sms, meeting, donation to constants |
| F2 | Message templates in Settings | Low | Template editor + variable substitution |
| G1 | Consent capture on visitor creation | Low | Checkbox + model fields |
| G2 | Do Not Contact flag | Low | Toggle + reminder/communication exclusion |
| F3 | v2→v3 data migration | Medium | StorageManager migration code |

**Does NOT include:** My Day Dashboard (moved to Iter 5 — needs interaction data to be flowing correctly first)

### Iteration 5: "The Know Release" — Intelligence & Dashboard
**Theme:** Understand your community and plan your day

| # | Feature | Effort | Notes |
|---|---------|--------|-------|
| D1 | My Day Dashboard (new home screen) | Medium | Today + overdue + follow-ups + stats |
| A1 | Engagement Health Score | Medium | EngagementService + visitor badges |
| A2 | Lapsed Visitor Detection | Low | Extends ReminderService |
| C3 | Interaction History View | Medium | New /interactions route |
| F4 | Sync log + known machines | Low | Track imports/exports |
| G3 | Volunteer attribution in UI | Low | Surface createdBy as volunteer name |
| G4 | Data quality indicator | Low | Computed metrics on analytics |

### Iteration 6: "The Share Release" — WhatsApp-Native Sync & Reports
**Theme:** Remove the #1 adoption blocker (file-share failure on Android), deliver board-ready reports

**Reshaped 2026-04-14.** Original plan focused on analytics + city planner. User feedback identified that after multiple iterations, the core complaint remains: **shared WhatsApp files don't re-open after download**. Since no app-layer fix can solve this (it's OS-level Scoped Storage behaviour), we pivot to bypassing files entirely for sync. E1 analytics and D2 city planner are valuable but don't move the needle on daily use the way H1 does — deferred to Iteration 7.

| # | Feature | Effort | Notes |
|---|---------|--------|-------|
| H1 | WhatsApp-native text sync | High | **Priority** — copy-paste sync with gzip+base64+CRC32, chunking for large payloads, Web Share API to WhatsApp |
| G5 | Backup (text-first + file fallback) | Low | Reuses H1 text format. Full state including reminderActions + settings |
| E2 | Text report export | Low | Monthly summary for WhatsApp + CSV export |
| E3 | Enhanced per-visitor timeline | Low | Contact frequency avg + next action above timeline |
| A3 | Smart contact frequency | Low | Per-visitor target + auto-reminder when overdue |

### Iteration 7: "The Reach Release" — Analytics, Planner, Platform
**Theme:** Coordinator reports, route planning, notifications

| # | Feature | Effort | Notes |
|---|---------|--------|-------|
| E1 | Coordinator Analytics Dashboard | Medium | **Moved from Iter 6** — Charts + tables + volunteer breakdown |
| D2 | Visit planner by city | Medium | **Moved from Iter 6** — Group-by-city + bulk log |
| F-Notif | Local notifications | High | Capacitor plugin + AndroidManifest + OEM guide |
| F-Contacts | Contact book import | High | Capacitor plugin + runtime permissions |
| B3 | Post-communication auto-log | Medium | visibilitychange + localStorage fallback |

---

## 7. Stakeholder Coverage Matrix

| Feature | P1 Rural Worker | P2 Coordinator | P3 Beneficiary | P4 Donor | P5 Auditor | P6 Ops | P7 Market |
|---------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| C1 Interaction Logger | Y | Y | | | Y | | Y |
| C2 Quick-Log | Y | | | | | | |
| B1 WhatsApp Links | Y | | | Y | | | Y |
| B2 One-Tap Actions | Y | | | | | | |
| D1 My Day Dashboard | Y | Y | | | | | Y |
| A1 Engagement Score | | Y | | | Y | | Y |
| A2 Lapsed Detection | | Y | | | | | |
| E1 Analytics | | Y | | | Y | | Y |
| E2 Reports | | Y | | | Y | | |
| G1 Consent | | | Y | | Y | | |
| G2 Do Not Contact | | | Y | | | | |
| G3 Volunteer Tracking | | Y | | | Y | | |
| G4 Data Quality | | Y | | | Y | | |
| G5 Backup to File | Y | Y | | | | Y | |
| F4 Sync Log | | Y | | | Y | Y | |
| F2 Templates | Y | | | Y | | | |

### Gaps remaining after v3 (deferred to Phase 3/4):
- **P1:** Marathi/Hindi UI (i18n framework), voice memos, app lock for shared phones
- **P2:** Volunteer performance dashboard, bulk merge tool for duplicates
- **P3:** Household-level preferences, phone update flow, deceased status handling
- **P4:** Donation data model, tax receipts, donor-specific dashboard
- **P5:** Full audit trail (who changed what), role-based access control
- **P6:** Cloud backup, in-app update check, fleet monitoring
- **P7:** Web dashboard, real-time sync, multi-branch support

---

## 8. Success Metrics

| Metric | v2 (Current) | v3 (Target) |
|--------|:---:|:---:|
| Steps to log an interaction | 3 (click → prompt → type) | 1 (one-tap quick log) |
| Steps to wish birthday via WhatsApp | 6+ (manual) | 2 (tap wish → send) |
| Reminder action creates Interaction record | NO | YES |
| Time to identify neglected visitors | Impossible | Instant (score) |
| Daily planning capability | None | Full dashboard |
| Communication channels supported | 1 (implied call) | 5+ (call, WA, SMS, email, visit) |
| Interaction types | 5 | 9 |
| Coordinator visibility into volunteer work | None | Full (sync log + attribution) |
| Visitor consent recorded | No | Yes |
| Analytics available | None | Growth, engagement, city, volunteer |
| Backup beyond sync | None | Full backup to file |

---

## Appendix: Files to Create/Modify per Iteration

### Iteration 4 (estimated ~15 files)
```
NEW:  src/components/UI/InteractionLogger.js    — Modal with full + quick modes
NEW:  src/services/EngagementService.js          — (stub) Score calculation
EDIT: src/models/Interaction.js                  — Add outcome, duration, followUpDate, followUpNotes
EDIT: src/models/Visitor.js                      — Add consentGiven, consentDate, doNotContact, contactFrequencyDays, engagementScore
EDIT: src/utils/constants.js                     — New interaction types, outcomes, templates
EDIT: src/services/InteractionService.js         — Support new fields
EDIT: src/services/ReminderService.js            — Skip doNotContact visitors
EDIT: src/core/state.js                          — Add version, knownMachines; migration code
EDIT: src/core/storage.js                        — v2→v3 migration in migrateState()
EDIT: src/components/Visitors/VisitorForm.js     — Consent checkbox, doNotContact
EDIT: src/components/Visitors/VisitorView.js     — InteractionLogger, action buttons, doNotContact badge
EDIT: src/components/Reminders/ReminderDashboard.js — Quick-log buttons, WhatsApp links, snooze options
EDIT: src/components/Settings/SettingsPage.js    — Message templates, lapse threshold
EDIT: src/components/Sync/SyncManager.js         — Sync log display, version warning
EDIT: src/styles/main.css                        — InteractionLogger, quick-log, action button styles
```
