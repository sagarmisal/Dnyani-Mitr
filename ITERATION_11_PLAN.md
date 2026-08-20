# Iteration 11 — "The Day Release": Calendar as Default Landing

> Owner: Claude (accountable for reliable, end-to-end delivery).
> Created 2026-08-18. Canonical PLAN + append-only progress log for Iter 11.
> Resume from THIS file. Verify against live code (code > docs).
> Companion: `VERSION_3_VISION.md §6` (what/sequence) · `PROJECT_PLAN.md §3` (history) ·
> `ITERATION_10_PLAN.md` (prior iteration, same format).

## Where this sits in the roadmap

| Iter | Theme | Headline | Version target | Status |
|------|-------|----------|----------------|--------|
| 10 | The Reach Release | Bulk occasion campaigns + local notifications | v3.1.0 / vc10 | CODE-COMPLETE, **device pass pending** |
| **11** | **The Day Release** | **Calendar as default landing + day-wise scheduling** | **v3.2.0 / vc11** | **PLANNED (this doc)** |
| 11.5 | Reach tail | B3 post-comm auto-log polish + F-Contacts phone import | v3.2.1 / vc12 | PLANNED (was 10.5) |
| 12 | The Field Release | Visit Planner by City | v3.3.0 / vc13 | PLANNED (was 11) |
| 13 | The Polish Release | Design-language elevation (UX-6) | v3.4.0 / vc14 | PLANNED (was 12) |

**Why this jumps the queue (sequencing owned by Claude, per delegated authority):**
1. It changes the **landing screen** — the highest-visibility change in the backlog. The
   earlier it ships, the more real volunteer feedback it collects before Iter 13 re-skins
   everything. Shipping it *after* a design pass would waste that design pass.
2. Iter 12's Visit Planner by City gets a natural home once a day pane exists (a city field
   round is a day's schedule filtered by city) — planning it first avoids building two
   divergent planning surfaces.
3. The old 10.5 tail (auto-log polish + contacts import) is small and fully independent, so
   deferring it costs nothing.

**Ship-gate coupling:** Iter 10 has never been verified on a device. This iteration changes the
first screen a volunteer sees, on top of that unverified release. The Iter 10 device checklist
(`ITERATION_10_PLAN.md §Manual test checklist`) is therefore **folded into this iteration's E5
device pass** — one APK, one device session, both checklists.

---

## Decisions locked (owner-confirmed 2026-08-18)

- **Scope = aggregate + schedulable.** The calendar both (a) surfaces every date the app already
  knows and (b) lets a volunteer put their own planned item on a day, mark it done, reschedule,
  or delete. A read-only calendar was explicitly rejected — it would not "manage" a schedule.
- **Calendar takes the home slot.** The `Dashboard` nav tab becomes `Calendar`; `#/calendar` is
  the default route. **My Day is NOT deleted** — it stays fully working at `#/dashboard`, reached
  from a "📋 Today's summary" link in the day pane. Revert is one line (`setDefaultRoute`).
- **Time-of-day slots and volunteer assignment are OUT** (the third option). Assignment would
  force scheduled items through sync merge, which is a separate design problem. A single optional
  `time` string is kept on the model so a later iteration can grow into a timeline without
  a migration.
- **Scheduled items are device-local in v1**, exactly like `occasions`/`campaigns`. The
  **Interactions they create do sync**. This is a documented limit, stated in the UI, not a bug.

---

## Universal per-task checklists (inherited verbatim from `ITERATION_10_PLAN.md`)

**Definitions.** *Correctness* = specified result for valid inputs, honors every consumer
contract, proven by a test. *Robustness* = survives invalid/edge/adversarial input (empty, null,
max-length, Devanagari, year/leap boundaries) without crashing, fails safe, idempotent where
required. *Reliability* = deterministic, persists across reload/WebView-kill/restart,
backward-compatible, offline-safe, zero regression to existing tests.

**PRE-task:** (1) read live source of every file touched + signatures of anything consumed
(code > docs); (2) confirm prior task's gate passed (build/tests green); (3) enumerate this
task's edge/adversarial inputs; (4) restate acceptance criteria.

**POST-task:** (1) `vite build` clean; (2) `vitest run` all green; (3) new behavior tested;
migration/model change null-safe + idempotent + v3.1.0-fixture tested; (4) data-flow rule
(every send/visit/completion logs an Interaction) + consent/DND honored; (5) Devanagari safe,
no secrets/PII to console/UI; (6) `cap sync` clean if web/native changed; (7) sync export→import
round-trip still works with new state keys; (8) adversarial self-read of diff + append
progress-log line.

---

## Phase 1 findings that drive the design (verified against live code 2026-08-18)

These are not assumptions — each was read in source. They are the reason this plan is shaped
the way it is.

| # | Finding | Where | Consequence for this iteration |
|---|---------|-------|-------------------------------|
| F1 | `normalizeEventDate()` forces every event into **this year or next**; a passed date rolls forward. | `src/utils/formatters.js:85` | The `Reminder` model **cannot represent a past occurrence**. A calendar that pages to any month must derive occurrences against the *requested* year. New derivation required — `Reminder` is reused for display, not for date math. |
| F2 | `getRemindersForMonth(monthIndex)` filters by **month index only, no year**. | `src/services/ReminderService.js:229` | Cannot be reused as the calendar's data source. Iter 9.3's `_annotateHandled` **can** be reused for the handled/snoozed pills. |
| F3 | `OccasionService.nextOccurrence()` already has correct **leap-clamped** `make(year)` math (Feb-29 → Feb-28 on non-leap years, never rolls into March). | `src/services/OccasionService.js:19` | Extract as shared `resolveAnnualDate(year, month, day)`; both the calendar and `nextOccurrence` call it. One implementation, bug class closed. |
| F4 | `getCurrentDate()` returns **UTC** (`toISOString()`), so `Interaction.interactionDate` is UTC. | `src/utils/formatters.js:124` | For IST, anything logged 00:00–05:30 local has a UTC date **one day earlier**. Keying the calendar by `interactionDate.split('T')[0]` would file it on the wrong day. All day-keying goes through a local helper. |
| F5 | **Pre-existing latent bug:** `_generateFrequencyReminder` builds its due date with `dueDate.toISOString().split('T')[0]`. | `src/services/ReminderService.js:135` | Same UTC off-by-one, already shipped. It directly blocks correct calendar placement, so it is **fixed in scope** (Phase 0C: fix only what blocks the task) with a regression test. |
| F6 | `toLocalISOString()` is correct but **module-private** (not exported). | `src/utils/formatters.js:75` | Export it; make it the single day-key helper. |
| F7 | `Interaction.followUpDate` + `followUpNotes` already exist and are set by `InteractionLogger`, but there is **no completion state**; `MyDayDashboard` only shows them when `followUpDate <= today`. | `src/models/Interaction.js:20`, `MyDayDashboard.js:118` | A follow-up stays due forever. The calendar makes this visible on day one, so completion must be added: additive `followUpCompletedAt` on `Interaction`. |
| F8 | `ROUTES.DASHBOARD` has exactly **5 references**, all in `main.js` + `router.js`. No component deep-links to it. | `src/main.js:104,146,159,272`, `src/core/router.js:97` | The landing switch is genuinely low-risk and trivially revertible. |
| F9 | `storage.js ensureForwardFields()` is the ready-made **idempotent** same-major migration hook (added Iter 10). | `src/core/storage.js:113` | New collection is a 4-line addition there. No new migration machinery. |
| F10 | `monthOnly` events (`dobMonthOnly` etc.) normalize to **day 1** of the month. | `formatters.js:85` + `ReminderService.extractEvents` | Rendering them as day-1 items would silently lie ("Sunita's birthday is the 1st"). They get a separate "sometime this month" strip. |
| F11 | `.app-nav` already carries 7 tabs and wraps at `max-width:768px`; Iter 9.5's overlap RCA was exactly this class of pressure. | `src/styles/main.css:128,200` | Nav count stays at 7 (rename, not add). The 7-column grid must hold ≥44px cells at large OEM font without horizontal scroll. |

---

## Data model & migration (v3.1.0 → v3.2.0)

### New state collection — `state.scheduledItems: []`

```
{
  id,                 // 'sched_<uuid>'  (prefix + UUID convention)
  date,               // 'YYYY-MM-DD' LOCAL day key — never a UTC ISO timestamp
  time,               // 'HH:MM' | null — optional, display+sort only in v1
  type,               // 'visit' | 'call' | 'meeting' | 'task'
  title,              // required, non-empty after trim, max 120 chars
  notes,              // '' default
  visitorId,          // string | null — optional link to a visitor
  status,             // 'planned' | 'done' | 'cancelled'
  completedAt,        // ISO | null
  interactionId,      // string | null — set when completion logged an Interaction
  createdAt, updatedAt, createdBy   // createdBy = machineId, matches existing records
}
```

Device-local in v1 (not exported by `SyncService`) — same posture as `occasions`/`campaigns`.

### Additive field on `Interaction` (synced)

`followUpCompletedAt: ISO | null` — closes F7. **Must be null-safe on read** because
`SyncService.merge` does **not** run records through model constructors (see memory
`reference_legacy_v2_migration`); an older machine's records arrive without the field.
Normalized alongside the other interaction fields in `storage.js` (~line 224).

### Migration — `ensureForwardFields`

```js
if (!Array.isArray(state.scheduledItems)) { state.scheduledItems = []; changed = true; }
```

Idempotent, re-runnable, seeds nothing (an empty schedule is the correct initial state, so
there is no "user cleared it" ambiguity like `occasions` had). Fixture test loads a real
v3.1.0 shape and asserts zero data loss.

### Settings

`calendarStartsOn: 'sun'` (`'sun' | 'mon'`) — **defaults to Sunday**, the prevailing convention on
Indian wall calendars and the one this NGO's volunteers will read fastest. Added through the same
forward-settings loop. No other calendar setting is reserved: `ensureForwardFields` makes adding one
later a 3-line change, so pre-declaring a `calendarDefaultView` we do not yet render would be
speculation, not planning.

---

## Derived item model (the calendar's read contract)

`CalendarService` returns a `Map<'YYYY-MM-DD', Item[]>`. Every item, whatever its source,
normalizes to:

```
{ id, kind, date, time|null, icon, title, subtitle, visitorId|null, contactId|null,
  sourceId, handled, handledReason, actions: [...] }
```

`kind` ∈ `event-reminder` · `contact-due` · `occasion` · `campaign` · `follow-up` ·
`scheduled` · `logged`. The day pane renders by `kind`; the grid only ever counts.

**Sort within a day:** timed items first (by `time`), then untimed by kind priority
(scheduled → follow-up → event-reminder → contact-due → occasion → campaign), handled items
last (reusing Iter 9.3's convention), `logged` in its own "already done today" footer group.

---

## ITERATION 11 — sequenced tasks

### Phase 0 — Baseline
- **0.1** `vite build` + `vitest run` (expect ≥146) + `cap sync` green before touching anything.
- **0.2** Capture the frozen baseline: HEAD hash, bundle size, test count, and a real exported
  state fixture from the live v3.1.0 install (used by every migration test below).
- **0.3** **BLOCKING — characterization tests (S2).** Pin current behavior of every shared
  function Phase A/B will touch, while the code is still known-good. No refactor starts until
  these are green.

### Phase A — Date foundation & data layer
- **A1** Export `toLocalISODate()` from `formatters.js`; add `localDayKey(isoOrDate)` (UTC-ISO →
  local `YYYY-MM-DD`); add `resolveAnnualDate(year, month1to12, day)` with leap clamping lifted
  from `OccasionService.nextOccurrence` (F3, F6). Unit tests incl. Feb-29, Dec-31/Jan-1.
- **A2** Point `OccasionService.nextOccurrence` at `resolveAnnualDate` — same behavior, one
  implementation. Existing occasion tests must stay green unchanged (proof of no regression).
- **A3** **Fix F5**: `_generateFrequencyReminder` uses `toLocalISODate(dueDate)` instead of
  `toISOString().split('T')[0]`. Regression test pinned to an IST 00:00–05:30 clock.
- **A4** `models/ScheduledItem.js` + validator (non-empty title, valid `YYYY-MM-DD`, `HH:MM` or
  null, enum type/status, ≤120-char title, Devanagari-safe).
- **A5** `state.scheduledItems` + `getScheduledItems/addScheduledItem/updateScheduledItem/
  deleteScheduledItem` following the exact `occasions` CRUD pattern (`state.js:264-290`) +
  EventBus events.
- **A6** `Interaction.followUpCompletedAt` additive + `storage.js` normalization + null-safe reads.
- **A7** `ensureForwardFields` addition + settings + **migration test from a v3.1.0 fixture**
  (asserts existing visitors/interactions/occasions/campaigns untouched, re-run is a no-op).
- **A8** **(G3)** Harden `InteractionService.log()` to reject a null/empty `visitorId`. Verified
  safe against all 4 call sites and the frozen test suite. Test the rejection path.
- **A9** **(G4)** `InteractionLogger.quickAction` gains an optional `interactionDate` (default
  now). Purely additive — existing callers and their tests must remain untouched, which is the
  proof of no regression.

### Phase B — CalendarService (pure derivation, no state of its own)
- **B1** `getItemsForRange(startKey, endKey)` skeleton + **event reminders** for arbitrary years
  via `resolveAnnualDate` (F1) — birthday/anniversary/death/custom, DND visitors excluded,
  `monthOnly` events **diverted** to a separate `monthWide` bucket, never day-1 items (F10).
- **B2** + **contact-due** (reuse `_generateFrequencyReminder`, now local-date correct) +
  **occasions** + **campaigns** (`campaign.date`).
- **B3** + **follow-ups** (open = `followUpDate` set and `followUpCompletedAt` null) +
  **logged interactions**, both keyed via `localDayKey` (F4).
- **B4** + **scheduled items**; annotate handled/snoozed by reusing Iter 9.3's logic (F2) so the
  calendar and the Reminders tab never disagree. **Note:** `_annotateHandled` is *private* to
  `ReminderService`; a cross-service call into an underscore method would plant exactly the kind of
  divergent pattern Phase 1D forbids. Promote it to a public `annotateHandled(reminder, actions,
  cycleWindow)` and have the existing private call site delegate — no behavior change, existing
  Iter 9.3 tests must stay green as the proof.
- **B4a** **(G1, amended by G12/G17)** `getOverdueBacklog()` — unhandled items across the 30-day
  lookback, for the pinned "Needs catching up" group; plus a per-day `hasUnhandledPast` flag so the
  grid can paint red dots. Reuses `generateReminders`' window; **no forked logic (G6)**.
  **G12:** the backlog includes **unfinished scheduled items**, not only reminders — a planned visit
  never moves off its own day (history stays truthful) but surfaces here until it is completed,
  rescheduled or cancelled, and its day keeps a red marker. **G17:** the caller receives the full
  list plus a `total`; the UI renders **5 and "+N more"**. There is deliberately **no bulk
  "clear all"** — it would write `contacted` against dozens of people nobody contacted, corrupting
  the interaction history every future reminder is computed from. A cluttered list is recoverable;
  falsified records are not.
- **B5** `getMonthMatrix(year, month, startsOn='sun')` → 6×7 local-date cells incl. leading/trailing
  days, plus per-day counts for density dots.
- **B6** `tests/calendar-service.test.js` — boundaries: month first/last cell, Feb-29 in a
  non-leap year, year rollover Dec→Jan, IST 00:00–05:30 logged interaction lands on the local
  day, monthOnly diverted, DND excluded, empty state, visitor with no contacts.

### Phase C — UI
- **C1** `components/Calendar/CalendarView.js` — month grid, ‹ › + Today, density dots (max 3
  then `+n`), selected-day highlight, ≥44px cells, no horizontal scroll at 320px/large font
  (F11), Devanagari-safe labels. Load `frontend-design` before writing markup.
- **C2** Day pane rendering every `kind`, reusing the **existing** quick-action buttons and the
  `InteractionLogger` DND guard — no new communication path is invented.
- **C2a** **(G1)** Pinned "Needs catching up" group on today's pane + red past-day dots in the grid.
- **C2b** **(G4)** Past-day pane: 'was due' / 'logged that day' / **"Log what happened that day"**
  → `InteractionLogger` with the date pre-filled, then offer to mark that day's unhandled
  reminders contacted.
- **C3** Add/Edit scheduled-item modal, following existing `ConfirmDialog`/`Toast` patterns.
  Visitor link is **optional (G3)**; a 'plans stay on this phone' note states the sync limit (G2).
- **C3a** **(G11)** "Plan a visit" action on any reminder in the day pane → opens the C3 modal
  with the visitor, type `visit` and that reminder's date prefilled. Planning is person-first;
  this is the entry point that fills the calendar from what the app already knows.
- **C3b** **(G11)** "Plan a visit" on the visitor page → same modal, visitor prefilled, date picked.
  Three entry points, **one** modal and one model — no second creation path to keep in sync.
- **C4** Mark-done paths **(G3, amended by G14)**: a scheduled item **linked to a visitor** logs an
  Interaction via `InteractionService.log()` (data-flow rule) and stores `interactionId`; an item with
  **no** visitor flips to `done` locally and logs nothing. Follow-up Done → sets `followUpCompletedAt`.
  **G14 — completion is one tap and can never fail.** Tapping done completes immediately and writes the
  Interaction; a small note field then slides in **already focused** ("How did it go?"). Typing saves it
  on blur; ignoring it loses nothing. No dialog, no save button, no way to be blocked. Friction stays at
  one tap for the people who will never write notes, and the people who would write them get the chance
  at the only moment they remember.
- **C5** `ROUTES.CALENDAR='/calendar'`, register, nav rename Dashboard→Calendar,
  `setDefaultRoute(CALENDAR)`, `/` redirect, `#/calendar?date=YYYY-MM-DD` deep link,
  "📋 Today's summary" link → `#/dashboard` (kept alive, F8).
- **C5a** **Landing kill-switch (S5)**: `landingScreen` setting + Settings toggle; `setDefaultRoute`
  honors it. Test both values.
- **C6** `tests/calendar-ui.test.js` happy-dom render smoke (grid renders, day select swaps the
  pane, add-item round-trips, Devanagari renders, no raw tokens).

- **C7** **Interim device checkpoint (S7)**: APK to Oppo + Redmi. Calendar usable, My Day intact,
  Reminders/Campaigns/Sync unchanged. Phase D does not start until this passes.

### Phase D — Integration & sweep
- **D1** **(amended by G15)** The Iter 10 daily digest **leads with today's plans** ("3 visits planned
  today"), reminders beneath (guarded; desktop no-op). `notificationsEnabled` defaults to **false** and
  the opt-in is buried in Settings, so today nobody receives a digest at all — which is why U1 carries a
  one-tap opt-in. This is also the **first time Iteration 10's notification path will ever have run on a
  phone**; E5a's pilot verifies it, and if it is broken there the opt-in is pulled from U1 and the
  calendar ships without the digest rather than delaying on it.
- **D2** `MyDayDashboard` gains a link back to the calendar (round trip closed both ways).
- **D3** **Bug-class grep**: every new dynamic value escaped. Iter 10's review found a stored-XSS
  via an unescaped phone in `GreetingQueue` — user-authored `title`/`notes` on scheduled items
  are the same class and must be escaped at every render site.

### Phase R — Safe delivery onto EXISTING installs (added 2026-08-20)

> **Why this exists.** Phase 0-E make the *feature* correct. Phase R makes the *upgrade*
> correct. Two defects found by inspection on 2026-08-20 mean that today, an NGO device that
> has to be reinstalled for any reason loses data permanently. Both are pre-existing (Iter 10
> vintage), neither is caused by the calendar, and both are directly in the blast radius of
> shipping a new release. Verified in source, not inferred.
>
> **R-DEFECT-1 — "Full backup" is not full.** `SyncManager.generateFullBackup()` stamps
> `metadata.backupType: 'full'` but its payload carries only `visitors, interactions,
> reminderActions, settings, syncLog, knownMachines`. It **omits `occasions` and `campaigns`**
> (Iter 10) and would omit `scheduledItems` (Iter 11). A volunteer who backs up, reinstalls,
> and restores silently loses every custom occasion and every campaign they ever built.
>
> **R-DEFECT-2 — A full backup FILE cannot be restored.** Only the *text/paste* route
> (`restoreFromText`, SyncManager.js:523) rebuilds state. The file route always goes to
> `SyncService.merge()`, which reads only `visitors/interactions/reminderActions` — so
> importing a `backupType: 'full'` file silently drops six collections and reports success.
> The safest-looking action a careful user can take is the one that loses their data.
>
> **R-DEFECT-3 — the signing key is an undocumented single point of failure.** There is no
> `signingConfig` anywhere in `android/` and no `keystore.properties`, so `assembleRelease`
> emits an unsigned, uninstallable APK — the only installable artifact is the **debug** APK,
> signed by `~/.android/debug.keystore` on the build machine (this laptop: SHA-1
> `70:E9:6A:21:8C:5D:35:3C:21:C6:91:88:A8:65:15:B6:C9:2E:7F:DD`, created 2025-12-08). That
> 2.6 KB file is currently the **only** thing that can ever upgrade the installed apps. It is
> not backed up. If it is lost, every volunteer must uninstall (destroying their data) to take
> any future release. `CLAUDE.md`'s claim that release builds "require keystore.properties" is
> stale and must be corrected.
>
> **R-DEFECT-4 — CI ships an incompatible APK.** `.github/workflows/build_apk.yml` runs
> `assembleDebug` on a clean runner and caches only npm + Gradle, never `~/.android`. The
> Android Gradle Plugin therefore generates a **fresh debug keystore on every run**, so each CI
> artifact is signed with a different throwaway key. Handing a volunteer a CI-built APK forces
> `INSTALL_FAILED_UPDATE_INCOMPATIBLE` → uninstall → total data loss. Nothing in the repo warns
> anyone about this.

**R0 — Make the backup genuinely complete. BLOCKING: no APK reaches a volunteer until R0 ships.**
- **R0.1** `SyncService.prepareFullBackup()` — one authoritative snapshot builder, moved out of
  the component (the payload is currently assembled inline in `SyncManager`, which is a service
  concern in a view). Carries **every** persisted collection: `visitors, interactions,
  reminderActions, occasions, campaigns, scheduledItems, settings, syncLog, knownMachines`,
  plus `machineId/machineName/machineRole` and `version`. Add a `collections` manifest to the
  metadata listing what is inside, so a future missing collection is detectable, not silent.
- **R0.2** `SyncService.restoreFullBackup(pkg)` — replaces (not merges) every collection, after
  `createBackup()` snapshots the current state. Refuses a package whose `metadata.backupType`
  is not `'full'`. Runs the restored state through `ensureForwardFields` so a **v3.1.0 backup
  restores cleanly into v3.2.0** (and a v3.2.0 backup into v3.1.0 loses only what that build
  cannot render).
- **R0.3** File-import path detects `metadata.backupType === 'full'` and routes to restore, on a
  visibly different confirmation screen ("This REPLACES everything on this device" vs sync's
  "This ADDS to what you have"). Fixes R-DEFECT-2.
- **R0.4** **The proof test** — `tests/backup-restore.test.js`: populate every collection
  (Devanagari, a campaign, a custom occasion, a scheduled item, a snoozed reminder action) →
  full backup → wipe to default state → restore → **deep-equal on every collection**. Plus a
  cross-version case (v3.1.0 fixture → restore into v3.2.0) and a reject-a-sync-file case. This
  test is the licence to ship; without it green, no device gets an APK.
- **R0.5** Guard against the next occurrence: a test asserting the backup payload's key set
  equals `getDefaultState()`'s key set minus a documented exclusion list. Any future collection
  added to state without being added to the backup fails the suite. This is the bug-class fix,
  not just the bug fix.

**R1 — Signature-stable upgrade (the actual deploy mechanic).**
- **R1.1 DECISION (owner-delegated, Claude):** **v3.2.0 ships signed with the EXISTING debug
  key, built on the owner's laptop.** Every installed phone upgrades in place: no uninstall, no
  re-activation, no data loss. A landing-screen change is never combined with a forced wipe.
- **R1.2 Back up `~/.android/debug.keystore` off-machine TODAY** (encrypted, two locations) and
  record its SHA-1 in `PROJECT_PLAN.md`. Highest value-per-minute action in this entire plan.
- **R1.3** Version bump: `versionCode` 10 → **11**, `versionName` **3.2.0** in
  `android/variables.gradle`, `package.json`, `src/utils/constants.js` (`APP_VERSION`). Android
  refuses a downgrade, so the bump is what makes the upgrade installable.
- **R1.4** Wire a real release `signingConfig` + gitignored `keystore.properties` **now, adopt
  at v4.0** — prepared, documented, unused this release. The adoption migration (full backup →
  uninstall → install → restore) is only safe *because* R0 exists, so it waits until R0 has
  been proven on real devices. Correct the stale `CLAUDE.md` line in the same change.
- **R1.5** Defuse CI: rename the artifact to `app-debug-CI-TESTING-ONLY.apk`, add a workflow
  summary line and a `README` note stating that CI APKs are signed with a throwaway key and
  must **never** be given to a volunteer. Fixes R-DEFECT-4 at the point of temptation.
- **R1.6** `scripts/verify-apk.sh` — prints the APK's signer SHA-1 and compares it to the
  expected fingerprint; run before any distribution. Pre-flight, not post-mortem.

**R2 — Desktop / laptop delivery.**
- **R2.1** Fixed install convention, documented once: **one folder, one filename, overwrite in
  place.** Browser storage is keyed to the file's origin — a new folder or a different browser
  reads as total data loss to the user even though nothing was deleted.
- **R2.2** **Upgrade rehearsal on desktop** — load real v3.1.0 data, overwrite `index.html` with
  the v3.2.0 build, reload, confirm data + calendar. Run on the browser the NGO actually uses.
- **R2.3** Ship a launcher (`.desktop` on Linux / `.lnk` on Windows) or a pinned bookmark so the
  same path is opened every time, which is what keeps the data reachable.
- **R2.4** Document the "Clear browsing data" hazard — it wipes the app's storage — which is the
  concrete reason U3's backup nudge exists.

- **R2.5** **(G16) "Wrong copy" guard — the laptop failure mode.** Browser storage is keyed to the
  file's location, so a volunteer who unzips to a new folder instead of overwriting in place opens
  an app with no data and an activation screen. Nothing was lost, but it is indistinguishable from
  total loss, and the natural reaction — re-enter the master key and start typing — creates a second
  divergent database. **Fix (~5 lines):** on the activation screen, add a calm line — *"Already using
  Dnyani Mitr and seeing this screen? You have opened a different copy of the file. Close it, open the
  original folder, and if you cannot find it, restore your backup."* Plus the guide's closing verify
  step: open the app, confirm Settings → About says **3.2.0** and the visitor count is unchanged.

### Phase U — Usability for the people who actually use this (added 2026-08-20)

> The users are NGO volunteers, often on low-end phones, reading Marathi first. A feature they
> cannot find is a feature that was not shipped.

- **U1** **"What's new" card on first run after an upgrade (amended by G15).** `state.version` is
  already stamped by `loadState()`, so the version *before* the upgrade is knowable — capture it and
  show a single dismissible screen: what the calendar is, where My Day went, how to plan a visit.
  Marathi primary, English secondary. Shown once, never again. **G15:** it ends with one tap —
  *"Remind me each morning at 9 am"* — which requests the Android notification permission in context,
  with an explanation, instead of as a bare system prompt. This is the whole delivery mechanism for
  planning: a plan nobody is reminded of is a plan that relies on remembering to open the app.
- **U2** **First-run coach marks on the calendar** — exactly two, non-blocking: "tap any day to
  see it" and "＋ to plan a visit". Dismiss on tap, remembered in settings.
- **U3** **Backup health nudge — the highest-value robustness feature in the release.** Last
  export is already derivable from `syncLog` (`direction: 'export'`), so no new tracking is
  needed. If the last backup is older than 14 days or never happened, show a calm banner on the
  calendar and a red dot in Settings → App Health, one tap to back up. Every data-loss path in
  Phase R ends with "…unless they had a recent backup"; this is what makes that true.
- **U4** **Language parity** — every new string Marathi-first with English secondary, matching
  the existing tagline convention. Zero English-only tokens in the calendar. Devanagari
  verified at render, not assumed.
- **U5** **Real-device accessibility** — ≥44px targets, no horizontal scroll at 320px, legible
  at 200% system font, and **overdue must not be communicated by colour alone** (the red past-day
  dot needs a shape or count too, for colour-blind volunteers).
- **U6** **Honest empty states** — a day with nothing on it says what the volunteer can do, not
  "No items". The sync limit ("plans stay on this phone") is stated where plans are created, in
  plain language, once.

### Phase S — Shareable plans: selective export over the WhatsApp channel (added 2026-08-20)

> **Reverses G13.** Plans were device-local on the assumption that the office did not need to see
> them. Owner corrected the assumption: these NGOs operate *entirely* by passing backups as WhatsApp
> messages — some run root+satellite, some are **all-satellite with no root at all** — and the point
> of this iteration is that a plan made at the office reaches the phone that will execute it.
>
> **Measured against the real channel** (`TextSyncService`: gzip → base64 → CRC32 → 3500-char chunks),
> with 25 visitors / 200 interactions / realistic varied Marathi text:
>
> | Payload | Size | WhatsApp messages |
> |---|---|---|
> | Everything (full backup) | 86 KB | **5** |
> | Plans only (15 items + the people they reference) | 6 KB | **1** |
> | One day (~4 plans) | 2 KB | **1** |
>
> The ratio *worsens over time*: the full backup grows with every interaction ever recorded, a week
> of plans stays one message forever. And failure surface scales with chunks — a 5-message import
> dies if any chunk is missed, misordered or truncated, and the volunteer only sees "it didn't work".
> A daily act must cost one message.

- **S1 — Three exports, named by the JOB, not by the data.** The open-ended menu (everything /
  only schedules / from today / for a day / …) is **rejected**: this persona takes the default every
  time, a choice they are unqualified to make reads as risk, and modes differing only by date range
  are indistinguishable *after the fact* — the receiver cannot tell "he sent only today" from "he sent
  everything and there was nothing else", which produces the one support call a remote team cannot
  afford. Exactly three, no date pickers, no per-visitor export, no field selection:
  1. **Send everything** — full backup (R0 payload). Rare. Also the routine *we* collect, since the
     dev team owns backup responsibility.
  2. **Send plans** — today forward, including cancellations. **1 message. The daily driver.**
  3. **Share this day** — a button *on the day pane*, not an export mode. Coverage/handover.
- **S2 — Sending IS assigning; there is no assignee field.** In this workflow you choose a recipient
  by choosing whose WhatsApp you open — that act *is* the assignment. An `assignedTo` field would need
  a shared roster and cross-device name matching, and breaks immediately on an office phone shared by
  three people. Imported items carry **provenance only**: "Sent by Office · 20 Aug".
- **S3 — Plans must carry the people they point at.** A plan whose `visitorId` is unknown on the
  receiving device renders as "Unknown". Two-part fix: denormalise **`visitorName` onto the item** so
  display can never break, and ship a stub (`id, name, phone`) for referenced visitors. **Do not
  auto-create visitors from stubs** — that pollutes the master list with half-records; hold the stub
  for display and let the link activate when the real visitor arrives on a later full sync.
- **S4 — Cancellation must travel, or the calendar lies to people.** Sync has no delete propagation
  (fine for visitors, fatal for plans): if the office cancels Tuesday and the cancellation never
  arrives, the volunteer makes the trip. Deleting a shared plan sets `status:'cancelled'` (already in
  the model) and cancelled items stay in the plans export for **30 days** so the recipient's copy is
  overwritten.
- **S5 — An import may never un-complete work.** Last-write-wins alone reverts a *completed* visit to
  *planned* if the sender edits afterwards. Hard rule: **`done` is terminal on the receiving device** —
  an incoming update may change title/notes, never flip done → planned. A plan is an intention, a
  completion is a fact, facts win.
- **S6 — Re-import is a no-op; stale import never reverts.** Forwarding the same message twice and
  pasting an old one after a new one are *normal* behaviour here, not edge cases. Stable `sched_` ids
  + LWW already give this; it must be **tested explicitly**, not assumed.
- **S7 — Duplicate-plan guard.** All-satellite NGOs have no authority, so two people can plan the same
  visitor on the same day. On import, match incoming (visitorId, date, type) against existing and
  present it as a duplicate rather than silently adding a second.
- **S8 — Import preview in plain language, never a silent merge.** "12 plans from Office. 3 cancelled.
  Your visitors and history are not changed." State what will change *and* what will not.
- **S9** Tests: payload-size assertion (plans export stays 1 chunk at realistic volume), idempotent
  re-import, stale-import-does-not-revert, done-is-terminal, cancellation propagates, orphan-visitor
  rendering, duplicate guard.

### Phase F — Fix file export/import on Android (added 2026-08-20)

> **The team believed files "don't work on mobile". They work fine — `saveFile()` is broken, and it
> reports success anyway.** Diagnosed in source 2026-08-20; every claim below read, not inferred.
>
> `saveFile()` (`helpers.js:149`) has three paths and on Android **all three fail**:
> **(1)** `navigator.share({files})` — Android System WebView does not implement the Web Share API,
> so `canShareText` is false and the path is skipped. This is *why* Capacitor ships `@capacitor/share`;
> dependencies are only `android`, `cli`, `core`, `local-notifications` — **it was never installed**.
> **(2)** `<a download>` — runs unconditionally, never consulting `caps.canDownload`, which the same
> file computes as `!isCapacitor` (line 122) and documents as unreliable. An anchor download in an
> Android WebView needs `WebView.setDownloadListener(...)`; `MainActivity.java` registers none, and a
> `blob:` URL cannot be handed to DownloadManager regardless. **Silent no-op.**
> **(3)** data-URI `window.open` — never reached, because (2) does not throw.
>
> **F-DEFECT-0 (severity: highest in the codebase).** `saveFile` then returns
> `{method:'download', cancelled:false}` and the UI says *"Backup file downloaded. Store it safely."*
> The app **manufactures false confidence about a backup that does not exist**. The incomplete backup
> (R-DEFECT-1) loses some data; this one convinces someone they are protected when they are not.
> Assume a volunteer is relying on such a backup **today**.
>
> Import is probably functional — Capacitor's `BridgeWebChromeClient` implements `onShowFileChooser`
> and FileReader reads `content://` URIs — but it is unproven and untestable in practice, because
> export never produced a file to import. The WhatsApp text route was excellent engineering built
> around a **bug**, not around a platform limit.
>
> **Governing rule (non-negotiable): the text route stays the guaranteed path** — never removed,
> demoted or hidden. Files become the *fast* path where they work. If the pilot shows OEM breakage we
> simply do not promote the file buttons and nothing is lost. Additive and fallback-preserving, the
> same discipline that keeps My Day alive behind the calendar.

- **F0 — Stop lying, first and separately.** `saveFile` reports honestly: if no path actually
  delivered a file, say so and offer "Send as message" in the same breath. Ship-blocking, and small
  enough that it lands before the rest of Phase F.
- **F1 — Real native export.** Add `@capacitor/filesystem` + `@capacitor/share`, reached at runtime
  via `window.Capacitor.Plugins` exactly as `LocalNotifications` and the custom `SmsPlugin` already
  are — so the web bundle and the single-file `file://` desktop build are **untouched** and the
  zero-new-dependency rule for the browser build survives. Write to `Directory.Cache` → `Share.share({
  files:[uri] })`. The file travels as a `content://` URI through the **already-configured**
  FileProvider (`file_paths.xml` covers `cache-path`) — which is exactly what MIUI/ColorOS do not
  break; raw storage writes are what they break.
- **F2 — "Save to phone" as a second action** (`Directory.Documents`) so a copy exists somewhere the
  volunteer can find later, independent of the share sheet.
- **F3 — Receive a backup by tapping it in WhatsApp.** Intent-filter for `ACTION_VIEW` / `ACTION_SEND`
  on the backup type, handled in `MainActivity` and handed to the web layer. Tap the attachment in the
  chat → pick Dnyani Mitr → it imports. No picker, no folder hunting, no scoped-storage archaeology.
  **This is the step that makes files easier than text rather than merely possible.**
- **F4 — `WebView.setDownloadListener`** in `MainActivity` as belt-and-braces for any anchor download
  that still reaches it.
- **F5 — Device-only verification.** F1/F3 are the sole work in this release that **cannot be proven
  by any test I write** — no unit test says anything about MIUI's behaviour. They are verified on the
  pilot phones (E5a) or they do not ship enabled.

### Phase V — Inbound visit intake & the annual return loop (added 2026-08-20)

> **The domain insight this iteration was missing.** Owner supplied three real phone calls, in
> deliberately rough paraphrase, to be analysed rather than transcribed: *"planning to visit on 20th
> Aug"*, *"…for my daughter's birthday celebration"*, *"…to celebrate my friend's or my birthday"*.
> All three attach a **reason** to the visit. In Indian NGO practice supporters come **to** the NGO on
> personally significant dates — a birthday, a child's birthday, an anniversary, a death anniversary —
> to sponsor a meal, a celebration, a donation.
>
> **Consequence: `visit` has been ambiguous in this codebase all along, and Phases B/C built the wrong
> one.** The day pane as designed (G10: "who do I need to see this week", plan → work the list) is
> **outbound**. These scenarios are **inbound**: the supporter comes in, and the NGO's job is to
> receive, thank, and ensure a return next year. Both are real; they are not the same list.
>
> **Why the phone call is the whole growth engine.** It is the only moment the NGO learns four things
> at once: that this person exists, their number, a date that matters to them, and that they are
> willing to give. Capture all four in the forty seconds of that call and the relationship recurs
> annually and unattended. Miss it and the person visits, is thanked at the door, and is never heard
> from again.

- **V1 — Intake is ONE screen, completable during the call.** Opened from a calendar day or a
  persistent "Someone is coming" action. No navigation, no second step, no save-and-continue.
- **V2 — Phone-first identity resolution.** The first field is the phone. Typing it either resolves to
  an existing supporter — name, past visits and occasions shown immediately — or begins a new one.
  Identity is settled before anything else is typed.
- **V3 — Occasion capture, three shapes, matching the three calls.** None / the caller's own /
  **someone else's**. Fields: whose, relationship, event type, and **the occasion's own date, which is
  stored separately from the visit date** — the common case is *near* the occasion, not on it (a
  daughter's birthday on the 18th, the family visits Sunday the 20th).
- **V4 — The graph grows from the call, with no new model.** A third-party occasion creates a Contact
  under that supporter with the correct `relationType` and an event. `RELATIONSHIP_TYPES` already has
  `CHILD`/`FRIEND`/`SPOUSE`/`PARENT` and `ReminderService` already derives annual reminders from contact
  events — so one call permanently adds a person **and** a recurring annual touchpoint.
- **V5 — Every COMPLETED visit creates an annual return-reminder on its own date**, carrying thank-you
  intent: *"XYZ visited on this day last year — for his daughter's birthday."* Nearly free: Phase B is
  already building the year-aware annual recurrence engine (`resolveAnnualDate`) this needs.
- **V6 — One day, one reminder.** Where a return-reminder and an occasion for the same person coincide,
  they render as a **single combined item**. Without this, a supporter whose visit fell on the birthday
  generates two reminders every year forever.
- **V7 — Outcome is recorded: happened, or did not.** People announce visits and do not come. Auto-
  completing every scheduled visit would send a warm thank-you for a visit that never happened — worse
  than sending nothing. Only a *happened* visit writes an Interaction and creates a return-reminder.
- **V8 — Thank-you at both horizons** — shortly after the visit, and again next year — reusing the
  existing `DEFAULT_MESSAGE_TEMPLATES.thankYou`, personalised with the occasion.
- **V9 — The day pane separates "Coming to us" from "We are going."**
- **V10 — Phone-intake records are marked and reviewable.** A name heard over a phone in Marathi is a
  name at risk of being misspelt; provenance makes later cleanup possible.

**V-DECISION — phone is mandatory, implemented as phone-FIRST, never as a blocking validation error.**
*Architecturally it already is the identity key* — repo convention: phone normalised to last 10 digits,
visitor natural key = SELF contact's first phone. A supporter without a phone cannot be deduplicated,
sync-matched, messaged or thanked. *But a hard-blocking field would actively corrupt the database:* a
staffer mid-call types `0000000000` to get past it, and under last-10-digit dedup **every garbage number
collides with every other garbage number**, silently merging unrelated people — and the sync's phone
tier then propagates that merge to every machine. A null phone is a record you cannot use; a fake phone
is a record that **eats other records**. Therefore: first field, required by default, with exactly one
honest escape ("caller didn't give a number") storing **null, never a placeholder**, and visibly marking
that visit untrackable.

**Explicitly OUT of scope:** donation / in-kind value tracking (compliance obligations, different
product). An optional free-text "purpose / what they're bringing" covers the need. **Group visits:**
capture an optional headcount; do **not** model individual attendees.

**Refinement of the owner's stated rule.** Owner described two branches: if the visit date *is* his
birthday, note the planned visit against it; if the birthday differs, store the visit date as
"last visit date" so next year flags a thank-you. Same outcome, expressed instead as **one invariant**
(V5: every completed visit creates an annual return-reminder) **plus one dedup rule** (V6) — so the two
branches cannot drift apart, and the coincident case stops producing duplicate reminders. Note also that
"last visit date" is **already derivable**: `_generateFrequencyReminder` computes its baseline from the
visitor's most recent interaction, so a completed visit updates contact-due automatically.

**Impact on earlier decisions.** **Demotes G10.** The day pane was designed as an outbound worklist on
the owner's answer that planning-ahead leads. Inbound intake is plausibly more frequent and more
valuable; the pane carries both sections, and if inbound dominates in real use it should lead. Model
impact: `ScheduledItem` gains `direction` ('inbound'|'outbound'), an occasion block, an outcome state,
and optional headcount — all additive, all inside the migration already planned.

### Phase O — Occasion greetings that land on the right day (added 2026-08-20)

> **Two-thirds of this request already shipped in v3.1.0 (Iter 10) — verified in source, not assumed.**
> `DEFAULT_OCCASIONS` seeds five built-ins, each with bilingual greeting **and** invitation templates
> plus bulk send: New Year (1 Jan), Republic Day (26 Jan), Maharashtra Day (1 May), **Independence Day
> (15 Aug)**, Gandhi Jayanti (2 Oct). **Foundation Day** also already works — it is a fixed Gregorian
> date, so a custom occasion handles it correctly forever; it needs adding once, not building.
> *Caveat: Iter 10 is code-verified only and has never run on a device — E5a covers it.*
>
> **O-DEFECT-1 — movable festivals cannot be represented, and the code claims they can.** Every seeded
> occasion is a **fixed civic date; not one is a festival.** No Diwali, Ganesh Chaturthi, Gudi Padwa,
> Holi, Dussehra or Eid. `Occasion` stores only `month` + `day`, but Indian festivals follow lunar /
> luni-solar calendars and move every Gregorian year — so an occasion entered with this year's Diwali
> date fires on the wrong day next year and **every year after, silently**. Worse, two comments
> (`Occasion.js:3`, `constants.js:155`) tell the user they may add "movable festivals via the manager".
> A confident wrong instruction is more damaging than absent support: someone trusts it and the NGO
> sends festival greetings to hundreds of supporters on the wrong day, publicly, in its own name.

- **O1 — Optional per-year date table.** `Occasion` gains `dates: { "2026": "MM-DD", ... }`, resolved by
  year. Fixed occasions keep `month`/`day` untouched — **nothing about 15 Aug or Foundation Day
  changes**. Additive; folds into the migration already planned.
- **O2 — NEVER guess a movable date. Non-negotiable.** No lunar computation (a panchang engine means
  regional Amanta/Purnimanta variants and a real chance of being subtly wrong, inside an offline
  single-file build with a no-new-dependency rule). When the current year is absent from the table the
  occasion **does not fire and does not extrapolate** — it surfaces as *"Diwali — date for 2031 not
  set"* in the Occasions manager with one tap to set it. A missing greeting is a small loss; a wrong
  one is a public embarrassment for the NGO.
- **O3 — Seed the festival list, but do NOT populate dates from model memory.** Claude builds the
  mechanism and the seed list (Gudi Padwa, Ganesh Chaturthi, Dussehra, Diwali, Holi, Guru Purnima,
  Eid al-Fitr, plus the fixed ones missing today — Makar Sankranti, Shiv Jayanti, Ambedkar Jayanti,
  Christmas). **Every movable date is sourced from a verified almanac and confirmed by the owner before
  it ships.** Recalling a dozen festivals across five years from memory would produce exactly the harm
  O2 exists to prevent. Fixed-date additions may be seeded directly.
- **O4 — "Needs a date" is a visible state**, not a silent absence: an Occasions-manager badge and a
  once-a-year nudge, so the table gets extended before the year turns rather than after a festival is
  missed.
- **O5 — Festivals appear on the calendar** via B2's occasion derivation, once resolved for that year.
- **O6 — Fix the two lying comments** in `Occasion.js` and `constants.js` in the same change.
- **O7 — Tests:** fixed occasion unchanged across years; movable occasion resolves per year; missing
  year yields no reminder and no guess; year rollover; a movable date that lands on 29 Feb.

**Loop this closes.** Occasions are currently device-local — absent from the sync package *and* from the
"full" backup (R-DEFECT-1). Once R0 includes occasions and S1 ships "Send everything", **Foundation Day
and the festival table, defined once at the office, finally reach every machine.** Today they cannot.

### Phase E — Ship
- **E1** Full sweep, target **≥230 tests** (198 today + Phase B/C/R/U), zero regression.
- **E2** Version bump v3.2.0 / vc11 across `package.json` + `constants.js` + `variables.gradle`
  (see R1.3 — `versionCode` **must** go 10 → 11 or the upgrade will not install);
  build + `cap sync` clean.
- **E3** Docs: `PROJECT_PLAN.md` §3 + §6, `VERSION_3_VISION.md` §6, this log; **create** `RESUME.md` — earlier plans
  reference it as "stale" but **it does not exist** (verified 2026-08-20, G24); correct the stale
  release-signing line in `CLAUDE.md` (R1.4).
- **E4** Adversarial review (parallel agents on the diff) + `/security-review` — now
  **mandatory, not conditional**: R0 widens the backup payload, so a PII surface demonstrably
  changes this release.
- **E5** **UPGRADE REHEARSAL — the release acceptance test.** Not "install the APK and look
  around". On a physical phone: install **v3.1.0 with real data**, take a full backup, install
  the v3.2.0 APK **over it** (no uninstall), then verify (a) every visitor, interaction,
  occasion and campaign survived, (b) the calendar renders and a visit can be planned and
  completed, (c) My Day still works at `#/dashboard`, (d) sync with a v3.1.0 machine still
  round-trips. Repeat on Oppo + Redmi + one desktop (R2.2). Then the destructive drill **on a
  spare device only**: uninstall → reinstall → restore from the full backup → confirm nothing
  was lost. That drill is what proves R0 actually works before anyone needs it.
- **E5a** **(G8) PILOT BEFORE BROADCAST — blocking.** One real volunteer phone + one laptop
  upgrade first, and nothing is broadcast until both report clean. The fleet is ~4 laptops +
  2–3 phones all installed from this laptop (owner-confirmed 2026-08-20), so signatures are
  expected to match and the pilot confirms it rather than discovering a problem. **If the phone
  shows "App not installed" (G9):** stay on the call with that volunteer — back up → send you the
  file → uninstall → install → restore → verify together. That is simultaneously the contingency
  AND the supervised proof of R0, which is why **R0 must be finished and tested before the pilot
  runs**. The pilot phone is also the first device ever to execute Iteration 10's notification
  path (G15); if it is broken there, the digest opt-in is dropped from U1 and the calendar ships
  without it.
- **E6** **Volunteer-facing upgrade guide**, one page, Marathi + English, with screenshots:
  back up first → install → what changed → who to call if it looks wrong. Published as a
  shareable page so it can go out over WhatsApp with the APK.
- **E7** Combined device checklist (Iter 10 + Iter 11) signed off before distribution.

---

## Definition of "production-ready" (inherited)

1. `vite build` clean; `vitest run` all green incl. new tests; `cap sync android` clean.
2. Migration verified from a live v3.1.0 state (no data loss; idempotent).
3. Data-flow rule upheld (completions create Interactions); consent/DND honored.
4. Marathi/Devanagari renders correctly; touch targets ≥44px; no console errors.
5. Adversarial review done; `/security-review` when PII touched.
6. Debug APK installed `-r`, smoke-tested on Oppo + Redmi (**device-verified** label).
7. Docs updated. Owner commits (we do not commit/push unprompted).

## Manual test checklist — Iter 11 (device)

- [ ] Upgrade in place over v3.1.0: all visitors/interactions/occasions/campaigns intact; app
      opens on the **Calendar**, not My Day; no migration error.
- [ ] Month grid: **Sunday-first** column order, correct weekday alignment for the month; today highlighted; ‹ › pages across a
      **year boundary** (Dec→Jan) and lands on the right cells.
- [ ] A visitor with a **29 Feb** birthday shows on 28 Feb in a non-leap year, not 1 March.
- [ ] A month-only birthday appears in the "sometime this month" strip, **not** on the 1st.
- [ ] Tap a day with a birthday → quick actions work, each logs exactly **one** Interaction.
- [ ] Add a scheduled visit with Marathi title → persists across app restart → mark done → an
      Interaction appears in History for that visitor.
- [ ] A follow-up marked Done disappears from its day and from My Day's Follow-ups card.
- [ ] Log an interaction between 00:00 and 05:30 IST → it appears on **today's** cell, not
      yesterday's.
- [ ] Phone system font Large/Largest → 7-column grid still fits, no horizontal scroll, no
      overlapping labels.
- [ ] **(G1)** With an unhandled birthday from 3 days ago: it appears in "Needs catching up" on
      today's pane AND its own past day shows a red dot.
- [ ] **(G4)** Tap a past day → "Log what happened that day" → the Interaction is dated **that
      day**, not today, and the day's unhandled reminders can be marked contacted.
- [ ] **(G3)** Complete a scheduled item with no visitor → no "Unknown Visitor" row appears in History.
- [ ] "📋 Today's summary" reaches My Day; My Day still works exactly as before.
- [ ] **Carry-forward — Iter 10 (never device-verified):** campaigns tab, custom occasion
      persists, SMS campaign logs one Interaction per recipient with DND/non-consented excluded,
      WhatsApp per-contact campaign, notification digest fires, launcher icon + "Dnyani Mitr"
      name, Reminders button labels do not overlap.

## Risk register

| Risk | Mitigation |
|------|------------|
| Landing change disorients volunteers mid-season | My Day kept intact + one-line revert (F8); day pane links to it; call it out in the device session |
| UTC/local off-by-one puts items on the wrong day | Single `localDayKey` helper (F4/F6); explicit IST 00:00–05:30 test; F5 fixed with a regression test |
| Feb-29 / year-rollover mis-placement | Shared `resolveAnnualDate` with leap clamp (F3) + boundary tests |
| Month-only events silently claim day 1 | Diverted to a `monthWide` strip (F10); never rendered as a dated item |
| 7-column grid breaks at OEM large font | ≥44px cells, no nowrap, no horizontal scroll — the Iter 9.5 rule; device check at Largest |
| Scheduled items not synced ⇒ "my plan vanished on the other phone" | Stated in the UI; the Interactions they create **do** sync; syncing them is a scoped Iter 12+ decision |
| New user-authored text is an XSS surface | D3 escape sweep — the exact class Iter 10's review caught in `GreetingQueue` |
| `followUpCompletedAt` lost by whole-record merge | Known Issue 7.6 (whole-record merge) applies; last-write-wins is acceptable for a completion flag — documented, not silently assumed |
| Perf on a large list (design target 5000 visitors) | `getItemsForRange` measured at 5000-visitor fixture; memoize per (year,month) invalidated on `state:changed` only if >50ms |
| Iter 10 still device-unverified underneath | Combined device checklist; one APK, one session; plus the C7 interim checkpoint so this is not a second unverified layer |
| **Refactoring shared helpers destabilises screens that work today** | **The whole Stability Contract (S1-S10): characterization tests before the first refactor, 146 existing tests frozen, additive-only + non-touch list, per-task green gate** |
| Volunteer stuck on a bad landing screen in the field | S5 kill-switch — they flip back to My Day in Settings, no APK |
| **Overdue work invisible on a date-organised landing** | **G1 pinned catch-up group + red past-day dots; reuses the existing 30-day lookback** |
| Orphan interactions with no visitor pollute History + sync | G3: only visitor-linked completions log; `log()` hardened to reject null |
| Backfilled interaction leaves its reminder still flagged red | G4: past-day backfill offers to mark unhandled reminders contacted |
| Three surfaces drift apart and contradict each other | G6: calendar forks no logic — one `ReminderService`, so drift is impossible by construction |
| Bundle/perf creep hurts low-end OEM devices | S8 measured budgets; zero new runtime deps (S1) |

---

## STABILITY CONTRACT (owner requirement, 2026-08-18)

> Owner: *"previous code and build was stable and working on laptop as well on mobile — make
> sure your plan keeps it stable after these changes."*

This is a hard constraint on the iteration, not a wish. The new Calendar screen is additive and
low-risk on its own; **the actual risk is Phase A/B, which refactors shared helpers that
Reminders, Campaigns, My Day, Notifications and Sync already depend on.** Everything below
exists to fence that.

### S1 — Zero new runtime dependencies

The calendar is built with vanilla DOM + CSS grid, like every other component. **No calendar
library, no date library.** A dependency would inflate the single-file `vite-plugin-singlefile`
bundle and risk the `file://` double-click path on the laptop — the two properties that make
this app work offline. `package.json` `dependencies` must be byte-identical before and after.

### S2 — Characterization tests BEFORE the first refactor (new Phase 0.3, blocking)

Every shared function this iteration touches gets its **current** behavior pinned in a test
*first*, while the code is still the known-good version. Then the refactor must keep them green
without editing them. This converts "I think it behaves the same" into a machine-checked fact:

| Locked before touching | Protects |
|---|---|
| `normalizeEventDate()` incl. month-only → day 1, passed-date roll-forward | Reminders tab, My Day, campaign suggestions |
| `getDaysUntil()` at local midnight | every urgency badge in the app |
| `OccasionService.nextOccurrence()` incl. Feb-29 clamp | Campaigns tab, occasion nudge |
| `ReminderService.generateReminders()` shape + windowing | Reminders tab, My Day, bulk SMS/WhatsApp |
| `_annotateHandled` handled/snoozed output | Iter 9.3 month-view pills |
| `_generateFrequencyReminder()` current output (**pre-fix**), then the corrected one | contact-due reminders |
| `storage.loadState` → `saveState` round-trip on a real v3.1.0 fixture | everyone's data |
| `SyncService` export → import round-trip | the whole multi-machine story |

### S3 — Existing tests are frozen

All 146 existing tests must pass **unmodified**. Editing one is treated as a behavior change:
it is forbidden unless the progress log records *what* behavior changed and *why it is
intended*. A test quietly adjusted to accommodate a refactor is the exact failure mode that
turns a stable build unstable, so this is the single most important rule in this document.

*(One pre-authorized exception: `_generateFrequencyReminder`'s UTC off-by-one fix (F5) is a
deliberate, owner-visible behavior change. Its characterization test is written twice — once
pinning the buggy output, then replaced by the corrected one in the same commit as the fix,
with the reason in the log.)*

### S4 — Additive-only in existing files; explicit non-touch list

New CSS lives in a **new, namespaced block** (`.cal-*`). These must not be edited:

- `src/styles/main.css` — the `.btn-sm { white-space: normal }` and
  `.view-header .btn { min-width: auto }` rules **are the Iter 9.5 overlap fix**. Not touched.
- `src/styles/variables.css` — `color-scheme: light` **is the Iter 9.4 dark-mode fix**. Not touched.
- `src/services/SyncService.js`, `TextSyncService.js` — sync is stable and device-proven. The new
  collection is device-local precisely so this file never opens.
- `src/services/SmsService.js`, `components/UI/GreetingQueue.js`, `SmsBatchQueue.js` — the send
  engines. The calendar reuses `InteractionLogger`; it does not invent a send path.
- `capacitor.config.json`, `android/**` (except `variables.gradle` version bump) — OEM WebView
  behavior is hard-won (Iters 6.5/6.6/8/9). No `allowNavigation`, no manifest edits.
- `MyDayDashboard.js` — one added link (D2), nothing else. It stays the working fallback.
- `components/Reminders/ReminderDashboard.js` — **nothing removed (G6)**, incl. the Iter 9.3
  "Show <month>" view. Overlap is accepted this release; Iter 13 consolidates from evidence.

Any file touched outside this discipline must be justified against a specific task ID.

### S5 — Landing kill-switch (new task C5a)

`setDefaultRoute` reads a new setting `landingScreen: 'calendar' | 'dashboard'` (default
`'calendar'`), exposed as a Settings toggle. If the calendar misbehaves on any volunteer's
phone, **they flip back to My Day themselves — no new APK, no data loss, no waiting for us.**
This is cheap insurance and it is what makes the landing change genuinely reversible in the
field, not just in git.

### S6 — Green gate at every task, not every phase

`vite build` + `vitest run` after **each** lettered task (A1, A2, …), not just at phase
boundaries. A task that leaves either red is not finished and the next task does not start.
Never leave a half-migrated, non-building intermediate — the plan's own additive-first rule.

### S7 — Interim device checkpoint at end of Phase C (new task C7)

An APK goes onto Oppo + Redmi **after the UI lands and before Phase D stacks more on top** —
not only at E5. Rationale: Iter 10 is itself still device-unverified, so this iteration must
not be the second unverified layer. If Phase C is bad on a device, we find out with two phases
left to absorb it instead of at the ship gate.

### S8 — Budgets, measured not assumed

| Property | Baseline (v3.1.0, measured 2026-08-18) | Ceiling |
|---|---|---|
| Single-file bundle | 378.82 kB / 136.12 kB gzip | ≤ 420 kB raw — exceed it and we stop and look |
| Test count | 146 passing | ≥ 165, none failing, none modified |
| `cap sync android` | clean | clean |
| Calendar month render | n/a (new) | < 100 ms at a 5000-visitor fixture, measured in Phase B6 |
| Cold start on device | current feel | no perceptible regression at C7 |

### S9 — Rollback plan (stated, not improvised)

1. **In-field, per phone:** Settings → landing screen → My Day (S5). Seconds, no reinstall.
2. **Pre-commit:** the work is uncommitted on top of a pushed HEAD — `git checkout -- .` restores
   the known-good tree exactly, as in Iter 9.5.
3. **Post-commit:** `git revert` of the iteration commit. Additive-only migration means reverted
   code simply ignores `state.scheduledItems` / `followUpCompletedAt`; **no data is lost and no
   downgrade migration is needed** — the fields sit unread until a re-install.
4. **Data:** a pre-iteration backup export is taken from the live install before the first device
   test (existing Sync → backup path).

### S10 — Laptop and mobile are both first-class at every gate

"Working" means both, every time: the `file://` single-file build opened by double-click on the
laptop **and** the APK on Oppo + Redmi. A gate passed on only one of the two is recorded as
half-passed in the log, never as done. Per memory `feedback_mobile_sync_verification`, every
claim in this iteration is labelled **device-verified**, **code-verified**, or **unchanged** —
never blurred.


---

## GRILLING OUTCOMES (2026-08-18) — six decisions, two defects caught

The plan was stress-tested with `/grilling` before any code. Two of the six exposed real
defects in the plan as written; all six are now binding.

### G1 — Overdue work gets a pinned group, not a date-honest burial
**Defect caught:** a calendar is organised by date, so an overdue birthday belongs to *its* past
cell — meaning the landing screen would have silently dropped the red Overdue card that My Day
uses to stop volunteers missing people. `generateReminders()` looks back 30 days precisely to
catch these.
**Decision:** today's day pane opens with a pinned **"Needs catching up"** group above today's
items, aggregating every unhandled item from the last 30 days (reusing the existing lookback, so
the calendar and the Reminders tab can never disagree). Past days holding unhandled items get a
**red dot** in the grid, so the month view itself shows where the misses are — something My Day
cannot do at all.

### G2 — Scheduled items stay device-local
Matches the `occasions`/`campaigns` precedent, keeps `SyncService` (the most device-proven code
in the repo) closed as the non-touch list requires, and avoids a real trap: the merge is
whole-record last-write-wins with **no delete propagation**, so a deleted item would be
resurrected by the next import. The UI states the limit plainly. **The Interactions completions
create still sync** — the record of what happened travels even though the plan does not.
Revisited at Iter 12, where distributing a city field round actually earns the complexity.

### G3 — Only visitor-linked completions log an Interaction
**Defect caught:** `InteractionService.log()` documents `visitorId` as required but does not
enforce it. A non-visitor task ("ward meeting") completed under the original plan would have
created an orphan interaction, rendering as **"Unknown Visitor"** with a dead
`#/visitor/view?id=undefined` link in History — and syncing that orphan to every machine.
**Decision:** a completion logs an Interaction **only** when the item is linked to a visitor —
which is what the data-flow rule actually exists to guarantee (contact with a *person* is
recorded). A personal task just flips to `done` locally. **Additionally: harden `log()` to reject
a null/empty `visitorId` outright.** Verified safe — all four existing call sites
(`SmsService:120`, `GreetingQueue:287`, `InteractionLogger:85` and `:258`) pass a real id, and no
existing test logs a null visitor, so no frozen test breaks.

### G4 — Past days are fully workable (backfill enabled)
This is the strongest justification for the calendar over My Day: volunteers work offline in the
field and enter it days later, and **My Day literally cannot reach Tuesday**. A past day shows
what was due, what was logged, and offers **"Log what happened that day"**, opening the existing
`InteractionLogger` with the date pre-filled. Items may also be added to a past date and
completed, for reconstructing a round.

**Defect caught while specifying it:** `quickAction` logs an interaction *and* calls
`recordAction(reminderId,'contacted')` (`InteractionLogger.js:92`), but the full-form logger
(`:258`) records **no** reminder action — so a free-form backfill would leave Tuesday's birthday
still flagged unhandled. And `quickAction` has no date parameter, so backfilling through it would
date the interaction *today*, contradicting the user's intent. **Both fixed additively:**
`quickAction` gains an optional `interactionDate` (default = now, so every existing caller and
frozen test is untouched), and a past-day backfill offers to mark the day's unhandled reminders
contacted. The reminder *action* timestamp stays "now" — you are recording the decision now —
while the *interaction* carries the backdated date.

### G5 — No recurrence in v1
Recurrence is the largest complexity sink in calendar software: an expansion engine, an end
condition, and per-instance exceptions ("skip just this Tuesday"), where getting exceptions wrong
corrupts the historical view. It is also partly solved already — `contactFrequencyDays` generates
recurring contact-due reminders, which is the recurring case that matters most here. Ship
one-offs, observe what volunteers retype by hand, design recurrence from evidence.

### G6 — Three overlapping surfaces are accepted for this release
Calendar, My Day and the Reminders tab (with its Iter 9.3 month view) will overlap. **Nothing is
deleted.** My Day must stay intact regardless — the S5 kill-switch depends on it being a working
landing — and the Reminders tab is not truly redundant, since it owns the bulk SMS batch bar and
filters that the day pane deliberately does not replicate. **Binding rule: the calendar forks no
logic.** It calls the same `ReminderService` functions, so the three surfaces can only disagree
if `ReminderService` itself is wrong. Iter 13 decides what to cut, using real volunteer feedback
instead of our guess.


---

## Granular execution checklist — track against this

Phase 0: **0.1** baseline · **0.2** frozen-baseline capture + live fixture · **0.3** characterization tests (blocking).
Phase A: **A1** date helpers · **A2** OccasionService reuse · **A3** F5 fix + regression ·
**A4** ScheduledItem model · **A5** state CRUD · **A6** followUpCompletedAt · **A7** migration test · **A8** harden `log()` (G3) ·
**A9** `quickAction` optional date (G4).
Phase B: **B1** range + event reminders · **B2** contact-due/occasions/campaigns ·
**B3** follow-ups + logged (local keying) · **B4** scheduled + handled annotation ·
**B4a** overdue backlog + red-dot flags (G1) · **B5** month matrix + counts · **B6** boundary tests.
Phase C: **C1** grid · **C2** day pane · **C2a** catch-up group (G1) · **C2b** past-day backfill (G4) · **C3** add/edit modal · **C4** completion → Interaction ·
**C5** route + nav + default + deep link · **C5a** landing kill-switch · **C6** render smoke ·
**C7** interim device checkpoint (gates Phase D).
Phase D: **D1** notification digest · **D2** dashboard cross-link · **D3** escape sweep.
Phase E: **E1** sweep ≥165 · **E2** version + build + sync · **E3** docs + RESUME refresh ·
**E4** adversarial review · **E5** APK + combined device checklist.

Report at each phase boundary (A/B/C/D/E).

## Progress log (append-only)

- 2026-08-18 — Plan authored. Phase 1 discovery done against live code (findings F1–F11 above,
  each read in source, not inferred). Owner confirmed: aggregate + schedulable scope; Calendar
  takes the home slot with My Day retained. Sequencing decided by Claude — inserted as Iter 11,
  pushing the former 10.5/11/12 to 11.5/12/13. Iter 10's device checklist folded into this
  iteration's E5. No feature code yet; baseline verified green (146/146, build 378.82 kB clean)
  at HEAD `20475ff` / v3.1.0.
- 2026-08-18 — Phase 0B self-review of this plan found three defects in the plan itself, all fixed
  above before any code: (1) week start defaulted to Monday — wrong convention for Indian users,
  now Sunday; (2) a reserved `calendarDefaultView` setting nobody renders — speculative, removed;
  (3) Phase B4 planned a cross-service call into `ReminderService._annotateHandled` (a private
  method) — now an explicit promote-to-public task instead of an encapsulation break.
- 2026-08-18 — Owner constraint added: the current build is stable on laptop AND mobile and must
  stay that way. Added the **Stability Contract (S1-S10)** and wired it into the sequence: new
  blocking Phase 0.2/0.3 (frozen baseline + characterization tests before the first refactor),
  C5a landing kill-switch, C7 interim device checkpoint gating Phase D, per-task green gate,
  explicit non-touch list protecting the Iter 9.4/9.5 CSS fixes and the sync + send engines,
  zero-new-dependency rule to preserve the single-file `file://` build, measured budgets, and a
  written 4-level rollback plan. Risk register updated. Still no feature code.
- 2026-08-18 — **Plan grilled (`/grilling`) before any code.** Six decisions locked (G1-G6),
  two of which caught real defects in the plan: (a) a date-organised landing would have silently
  dropped My Day's overdue safety net — fixed with a pinned catch-up group + red past-day dots;
  (b) 'mark done → log an Interaction' would have created orphan 'Unknown Visitor' records that
  sync everywhere, because `log()` never enforced its own documented contract. Also specified
  past-day backfill (the strongest reason a calendar beats My Day for an offline field app) and
  the two additive fixes it needs. Tasks A8/A9/B4a/C2a/C2b added; risk register, device checklist
  and non-touch list updated. Still no feature code.
- 2026-08-18 — **PHASE 0 COMPLETE (0.1 / 0.2 / 0.3). No src/ file touched yet.**
  **0.1 baseline:** `vitest` 146/146 · `vite build` 378.82 kB / 136.12 kB gzip clean ·
  `cap sync android` clean (1 plugin: @capacitor/local-notifications@8.2.0). HEAD `20475ff`, tree
  clean apart from the untracked backup zips.
  **0.2 frozen baseline + fixture:** recorded above. `tests/fixtures/state-v3.1.0.json` generated
  **through the app's own models and defaults** (Visitor/Contact/Interaction constructors +
  DEFAULT_SETTINGS + DEFAULT_OCCASIONS) rather than hand-typed, so it is faithful by construction:
  3 visitors (Devanagari names, one `doNotContact`, one month-only DOB, one 29-Feb DOB, one with
  `contactFrequencyDays`), 3 interactions (one open follow-up, one logged at 21:00Z = 02:30 IST
  next day), 2 reminderActions (contacted + snoozed), 5 seeded occasions, no `scheduledItems`.
  *Caveat: this is a representative fixture, not the owner's live 25-visitor export — a real export
  should still be run through the migration during the E5 device pass.*
  **0.3 characterization suite (S2, blocking):** `tests/characterization.test.js`, **25 tests, all
  green**, pinning `normalizeEventDate`, `getDaysUntil`, `getCurrentDate`/`getCurrentDateOnly`,
  `OccasionService.nextOccurrence`, `StorageManager` load/save/ensureForwardFields idempotency,
  `generateReminders` windowing, `getRemindersForMonth` + handled annotation, and
  `_generateFrequencyReminder`. Pinned in **Asia/Kolkata** via a runtime TZ override + fake
  timers, so it is deterministic on any machine — the existing suite is not (Iter 9.5 had to
  rewrite a test for an IST flake).
  **Three findings confirmed by execution, not inference:**
  (1) **F1/F2 confirmed** — `getRemindersForMonth` is year-blind: asking for month index 7 cannot
  distinguish August 2026 from August 2027. It cannot back a calendar grid.
  (2) **NEW — leap-day divergence between two live subsystems.** For the same 29-Feb date,
  `normalizeEventDate` overflows to **1 March 2027** while `OccasionService.nextOccurrence` clamps
  to **28 Feb 2027**. Both behaviours are now pinned, so the shared `resolveAnnualDate()` in task
  A1/A2 cannot silently change either one. This is exactly the bug class F3 predicted, and it is
  already shipped — a volunteer with a 29-Feb birthday in their list sees it on the wrong day today.
  (3) **F5 confirmed and pinned as PINS-A-BUG** — `_generateFrequencyReminder` reports
  `eventDate: '2026-06-11'` while deriving `daysUntil` from the local midnight of the **12th**: the
  record is internally inconsistent by one day. Task A3 fixes it and replaces that expectation.
  **Gate:** full suite **171/171** (146 frozen + 25 new), build clean, and `git status` shows only
  untracked additions — **no existing `src/` or `tests/` file modified**, which is the S3 proof.
- 2026-08-20 — **PHASE A COMPLETE (A1–A9). Gate green: `vitest` 198/198 · `vite build`
  379.95 kB / 136.39 kB gzip clean** (baseline 378.82 kB; S8 ceiling 420 kB — +1.13 kB spent).
  Green gate re-run after **every** lettered task per S6, not just at the phase boundary.
  **A1** `toLocalISODate` promoted from a private helper to a named export; `localDayKey()` and
  `resolveAnnualDate()` added to `formatters.js`. **A2** `OccasionService.nextOccurrence` and
  `_isoLocal` now delegate to the shared helpers — the 9 existing occasion tests stayed green
  **unchanged**, which is the no-regression proof. **A3** F5 fixed: `_generateFrequencyReminder`
  now derives `eventDate` from `toLocalISODate(dueDate)` instead of the UTC day, so `eventDate`
  and `daysUntil` finally describe the same day. *Known, accepted consequence:* `rawDate` feeds
  the reminder id hash, so an affected ContactDue reminder changes id once and may resurface a
  single time before self-healing. **A4** `models/ScheduledItem.js` + `validate()` (real-calendar
  date check rejects `2026-02-30` and `2026-02-29`, accepts `2028-02-29`; 120-char title
  boundary; `HH:MM` or empty; enum type/status; Devanagari preserved). **A5** `scheduledItems`
  CRUD on `StateManager`, following the `occasions` pattern exactly. **A6/A7**
  `Interaction.followUpCompletedAt` additive, normalized on v2→v3 and back-filled by
  `ensureForwardFields`; `scheduledItems: []`, `calendarStartsOn: 'sun'` and
  `landingScreen: 'calendar'` land forward without clobbering existing settings; re-run is a
  no-op. **A8 (G3)** `InteractionService.log()` now throws on a null/empty `visitorId` — audited
  against all 4 call sites and the frozen suite first; no orphan "Unknown Visitor" record can be
  created or synced. **A9 (G4)** `InteractionLogger.quickAction` accepts an optional
  `interactionDate`, purely additive, existing callers untouched.
  **S3 EXCEPTION #2 (documented in-file):** two characterization tests were written as
  `BASELINE GAP` assertions and began failing after A6/A7 — *because the migration works*. They
  were not weakened: each was converted into a stronger `MIGRATION:` test asserting both that
  the raw fixture is still genuinely pre-migration **and** that `loadState()` upgrades it without
  disturbing surrounding data, plus 3 new migration tests. Characterization suite 25 → 29.
  **New tests:** `tests/scheduled-item.test.js` (23) + 4 characterization = 171 → 198.
  **Hygiene:** three files (`storage.js`, `constants.js`, `InteractionService.js`) had been
  rewritten LF while the repo tracks them CRLF, inflating the diff to 1,436 lines of pure
  line-ending churn. CRLF restored; the working diff is now **157 insertions / 23 deletions**
  across 9 files — content only. Gate re-verified green after the fix.
  **Not started:** Phase B (CalendarService). **Nothing committed** — owner gates commits.

---

## The deliverable, defined (added 2026-08-20)

"Done" is not "the calendar works on my laptop". The deliverable is **an upgrade that lands on
the NGO's existing devices without anyone losing anything, and that a volunteer understands
without being trained.** Five things ship together:

1. **The feature** — calendar as landing, day pane, plan/complete/reschedule a visit (Phases B, C, D).
2. **A backup that is actually complete, and a restore that actually restores** (Phase R0).
3. **An upgrade that installs over the existing app** — right signing key, bumped versionCode,
   a documented desktop overwrite path (Phases R1, R2).
4. **A volunteer can find it and trust it** — what's-new, two coach marks, backup nudge,
   Marathi-first strings (Phase U).
5. **Proof, not confidence** — the upgrade rehearsal and the restore drill on real hardware (E5).

**Critical path.** R0 is the long pole: it gates every device deployment, and it is independent
of the calendar. Sequence: **B → R0 → C → U → D → R1/R2 → E**. R0 lands right after Phase B
while the work is still in the services layer, so the safety net exists before the first APK is
ever handed to anyone.

**Order of risk, highest first:** (1) losing the debug keystore — mitigate today, R1.2;
(2) an incomplete backup meeting an unavoidable reinstall — R0; (3) a CI-built APK reaching a
volunteer — R1.5; (4) the landing-screen change confusing existing users — U1/U2 plus the S5
kill-switch; (5) calendar correctness — already covered by the characterization suite and Phase B6.

## Open questions for the owner (non-blocking; needed before E5)

1. **Which version is on the volunteers' phones right now** — v3.1.0 with the Campaigns tab, or
   the earlier v3.0.6/3.0.7? Decides whether Iter 10's device checklist stays folded into E5.
2. **Was the installed APK built on this laptop?** If yes, the in-place upgrade is safe as
   planned. If it came from GitHub Actions, the signature will not match and we must plan a
   backup-and-reinstall for those devices instead. If unsure, we find out safely: take a full
   backup on one phone, try the upgrade, and see whether it installs.
3. **Do plans need to be shared** between the coordinator and volunteers? v1 keeps them
   device-local by design. If shared planning is the actual need, say so and I will re-scope —
   my recommendation is to ship device-local first and let real use decide, because syncing
   plans drags in merge conflicts and assignment, which is a separate design problem.

## Progress log (append-only) — continued

- 2026-08-20 — **Plan extended to a release deliverable, on owner request** ("perfect deliverable
  … robust, correct, easy to use … helping them help more people"). Read-only audit of the
  delivery path found **four pre-existing defects, none caused by the calendar, all in this
  release's blast radius**: the "full" backup omits `occasions`/`campaigns` (and would omit
  `scheduledItems`); a full-backup **file** cannot be restored at all because the file route
  always merges; the debug keystore that is the only thing able to upgrade the installed apps is
  a single un-backed-up 2.6 KB file; and CI publishes an APK signed with a per-run throwaway key
  that would force an uninstall. Added **Phase R** (safe delivery, R0 blocking) and **Phase U**
  (volunteer usability), rewrote Phase E around an **upgrade rehearsal + restore drill** as the
  acceptance test, and raised the test target to ≥230. Decision taken under delegated ownership:
  **v3.2.0 ships on the existing debug key from the owner's laptop** — zero uninstall, zero data
  loss; proper release signing is wired now but adopted at v4.0, once R0 has been proven on real
  hardware. No feature code written this turn.

---

## GRILLING OUTCOMES — ROUND 2 (G7–G17), 2026-08-20

> Second `/grilling` pass, run against the *extended* plan (feature + Phase R + Phase U + Phase E).
> Round 1 (G1–G6) grilled the feature; this round grilled **the delivery**. Eleven decisions, four
> of which changed what gets built. Codebase-answerable questions were answered from source, not
> asked.

**G7 — Distribution is self-serve, and that is a decision with teeth.** APK + `index.html` go out
over WhatsApp with personal instructions and a mandatory-backup instruction; **no process gate**
(an alternative — "no backup file received, no APK sent" — was offered and declined in favour of
speed). Two consequences stated plainly rather than hidden: (a) **U3's backup nudge cannot protect
this rollout** — it ships *inside* v3.2.0, so it only starts warning people once they have already
upgraded; it protects the *next* upgrade. (b) The written guide is therefore not documentation, it
is **safety equipment**, and E6 is a release-blocking deliverable, not a nicety.

**G8 — Pilot before broadcast (new task E5a, blocking).** One real volunteer phone + one laptop
first. Fleet confirmed by owner: **~4 laptops + 2–3 phones, all installed from this laptop** — so
the installed APKs carry `~/.android/debug.keystore` and the in-place upgrade is expected to work.
Because provenance is uniform, one pilot **does** generalise (it would not if any device had taken
a GitHub-Actions build — those are signed with a per-run throwaway key).

**G9 — Pilot-failure contingency, decided in advance.** If the phone shows "App not installed",
that volunteer becomes the **supervised restore test**: back up → send the file → uninstall →
install → restore → verify together. This is why **R0 must be complete and tested before the pilot
runs**, which fixes the critical path: **B → R0 → C → U → D → R1/R2 → E**. Note the trap this
defuses: Android's "App not installed" message leads every volunteer who searches for it to the
advice *"uninstall the old one first"* — the single action that destroys their data. The guide must
name that error and say **stop, do not uninstall, message me**.

**G10 — SUPERSEDED 2026-08-20 by G10-R (see below): inbound leads, not planning.** Original: **The day pane leads with planning.** Not a due-list, not a backfill screen. The volunteer
sits down, looks at the week, and puts visits on days; the pane is their worklist. Due reminders sit
beneath the plan. Capacity becomes visible, which is the mechanism by which this helps them reach
more people.

**G11 — Planning is person-first, so there are three entry points (C3a, C3b added).** Day-first
alone was rejected: nobody thinks "Tuesday needs a title", they think "I should see Sunita". A
"Plan a visit" action now lives on **reminders** and on the **visitor page** as well as the day's
＋ button — three doors, one modal, one model.

**G12 — An unfinished plan never disappears and never lies (B4a amended).** It stays on its own
day, so history stays truthful, and surfaces in "Needs catching up" with a red marker on that day
until it is completed, rescheduled or cancelled. Auto-rolling it forward was rejected: it would
rewrite the past and hide that something had slipped for nine days.

**G13 — Plans stay device-local. Closed.** The coordinator does not need to see or assign them;
each person plans their own days. Completed visits still reach the office as Interactions, so the
record of what *happened* travels even though the intent does not. The model already carries what a
future sync would need — this is a deferral, not a dead end.

**G14 — Completion is one tap and cannot fail (C4 amended).** Done is instant; an optional note
field slides in already focused and saves on blur. The full interaction form was rejected as a
completion path: it turns "mark done" into paperwork, and the result is visits that happen and are
never recorded — the calendar drifting out of step with reality.

**G15 — The release actively recruits people onto the morning digest (U1, D1 amended).**
`notificationsEnabled` defaults to `false` and its opt-in is buried in Settings, so **today nobody
gets a digest at all**; the what's-new card ends with a one-tap "remind me each morning at 9 am"
that requests the permission in context. The digest headline becomes today's plans. Enabling
notifications by default was rejected — it flips a setting nobody chose and spends the one
permission prompt with no explanation attached. The pilot phone is the first device ever to run
Iteration 10's notification code; **if it is broken there, the opt-in is dropped and the calendar
ships without it** rather than the release waiting on it.

**G16 — The laptop failure mode is the wrong copy, not the signature (R2.5 added).** Storage is
keyed to the file's location, so unzipping to a new folder instead of overwriting in place presents
an activation screen and an empty app — indistinguishable from data loss, and the natural response
creates a second divergent database. Fixed with ~5 lines on the activation screen plus a closing
verify step in the guide (version says 3.2.0, visitor count unchanged).

**G17 — Day one must not open with a wall of failure (B4a amended).** With 30 days of lookback over
~25 visitors of real, imperfectly-maintained data, the catch-up group could debut as fifty overdue
items on the landing screen — turning the calendar's first impression into an accusation. Capped at
**5 + "+N more"**: nothing hidden, nothing falsified, first screen finishable. A bulk "clear all"
was explicitly rejected — it writes `contacted` against people nobody contacted and corrupts the
history every future reminder is derived from.

## Progress log (append-only) — continued

- 2026-08-20 — **Second grilling pass complete (G7–G17). Still no feature code.** This round
  stress-tested delivery rather than the feature, and changed the build in four places: three
  creation entry points instead of one (C3a/C3b), unfinished plans folded into the catch-up backlog
  (B4a), one-tap completion with a non-blocking inline note (C4), and the digest promoted to the
  what's-new card with plans as its headline (U1/D1). It also added two tasks that exist purely
  because the rollout is self-serve: **E5a** (pilot one real phone + one laptop before broadcast,
  blocking) and **R2.5** (the "wrong copy" guard on the activation screen). Critical path fixed as
  **B → R0 → C → U → D → R1/R2 → E**, because the pilot's own contingency depends on R0 already
  working. Two owner questions closed that had been open since the plan was written: the fleet is
  ~4 laptops + 2–3 phones all installed from this laptop (so signatures should match and one pilot
  generalises), and plans stay device-local. One risk accepted with eyes open: with no backup gate,
  the only protection for *this* rollout is the written instruction and the signature being right —
  U3's nudge protects the next upgrade, not this one.

---

## Amended critical path and release shape (2026-08-20, after Phase S + Phase F)

**B → R0 → F0 → C → S → U → D → F1/F2/F3/F4 → R1/R2 → E**

- **R0 before the pilot** (G9): the pilot's own contingency is backup → uninstall → install → restore.
- **F0 immediately after R0**: the false "backup saved" message is actively dangerous and is a
  handful of lines. It must not wait for the rest of Phase F.
- **S after C**: selective export needs the scheduled-item UI to exist to be worth anything.
- **F1–F4 late**: native work, verified only on hardware, and gated so the text path is never at risk.

**Honest scope statement.** Iteration 11 now carries four things: the calendar (B/C/D), the delivery
and backup fixes (R), shareable plans (S), and native file I/O (F). That is roughly **+4 to +6 days**
over the original feature-only plan. It is bundled rather than split for an operational reason, not a
technical one: a rollout to remote NGOs over WhatsApp is expensive and the dev team owns it — one APK,
one device pass, one broadcast beats three. The technical cost of bundling is a wider device-verification
surface, which E5a's pilot absorbs.

**What "complete solution" now means, concretely.** An NGO with any topology — root+satellite or
all-satellite — can: plan a day's visits at the office; send that day or that week as **one** WhatsApp
message *or* as a file the recipient opens by tapping it in the chat; have the receiving volunteer see
those visits on their calendar with the right people attached; complete them in one tap; send back
what happened; and be recovered completely from a backup if any device is lost — with the text route
always available when files fail, and the file route available when text is tedious.

## Progress log (append-only) — continued

- 2026-08-20 — **Scope extended twice more, both owner-driven, both accepted with reasons stated.**
  **(1) Shareable plans (Phase S).** Owner corrected the assumption behind G13: these NGOs run
  *entirely* on backups passed as WhatsApp messages, some with no root machine at all, and the point
  of the iteration is that a plan made at the office reaches the phone that executes it. Approved the
  requirement and the mechanism; **rejected the open-ended export menu** in favour of three exports
  named by the job. Justified with measurement rather than opinion: against the real
  `TextSyncService` pipeline, a full backup of 25 visitors / 200 interactions is **5 WhatsApp
  messages** while a week of plans is **1**, and that ratio only worsens as history accumulates.
  Five merge rules specified that the original proposal did not cover (S2–S7), of which the load-bearing
  ones are *sending is assigning* (no assignee field — it fits the WhatsApp workflow and survives
  shared office phones), *cancellation must travel* (or a volunteer makes a cancelled trip), and
  *`done` is terminal on the receiving device*.
  **(2) Native file I/O (Phase F).** Owner reported files "not working on mobiles". Diagnosed in
  source: not a platform limit — `saveFile()` fails on all three of its paths on Android (no Web Share
  API in WebView; no `@capacitor/share` installed; no `setDownloadListener`; blob URLs unusable by
  DownloadManager) **and then reports success anyway**. Logged as **F-DEFECT-0, the highest-severity
  defect found in this codebase**: it manufactures false confidence in a backup that was never
  written, which is worse than the incomplete-backup defect because that one at least produces a file.
  F0 (honest reporting) is pulled forward ahead of the rest of Phase F. The WhatsApp text route is
  confirmed as excellent engineering that was built around a bug rather than a platform limit, and is
  locked as the **guaranteed** path — Phase F is strictly additive on top of it.
  Critical path re-derived; release scope now +4 to +6 days over the feature-only plan. Still no
  feature code written.

---

## G10-R — Inbound leads the day pane (owner-confirmed 2026-08-20, supersedes G10)

Owner confirmed: **inbound is the primary flow.** The day pane's order is therefore:

1. **Coming to us** — inbound visits (Phase V), the reason most days have anything on them at all.
2. **Needs catching up** — the pinned overdue group (G1/G17), capped at 5 + "+N more".
3. **We are going** — outbound plans the volunteer made for themselves (G10's original subject).
4. **Occasions & reminders for the day** — birthdays, anniversaries, festivals (Phase O), campaigns.

Everything decided in G11 (three creation entry points), G12 (unfinished plans stay put and surface in
catch-up), G14 (one-tap completion with a non-blocking note) and G17 (cap the catch-up list) is
unchanged — it applies to both directions. What changes is **order and emphasis**: the outbound
worklist framing was built on the pre-V understanding of "visit" and is now the second section, not the
first. C1/C2 must be written against this ordering, not retro-fitted to it.

## Progress log (append-only) — continued

- 2026-08-20 — **Phase V (inbound intake) and Phase O (occasion greetings) added; G10 superseded.**
  **Phase V** came from three deliberately rough phone-call paraphrases supplied by the owner for
  analysis. The domain reading: in Indian NGO practice supporters come **to** the NGO on personally
  significant dates to sponsor a meal or celebration — so `visit` has been ambiguous in this codebase
  all along and Phases B/C had built the **outbound** one. Owner then confirmed inbound is primary
  (**G10-R**). Ten requirements articulated (V1–V10), of which the load-bearing ones are: phone-first
  identity resolution; occasion capture that stores the occasion's own date **separately** from the
  visit date; third-party occasions creating a Contact + event so the existing reminder engine carries
  the relationship forward unattended; **outcome recorded as happened / did-not-happen** (auto-completing
  would thank people for visits that never occurred); and one invariant + one dedup rule replacing the
  owner's two-branch formulation, so they cannot drift and coincident dates stop double-reminding.
  **V-DECISION on the owner's explicit question — phone mandatory?** Yes, but phone-**first**, never a
  blocking validation error, with one honest escape storing **null, never a placeholder**. Decisive
  reason is specific to this codebase: phone *is* the identity key (normalised last-10-digits), and a
  hard-required field makes a mid-call staffer type `0000000000` — under last-10-digit dedup every
  garbage number collides with every other, **merging unrelated supporters**, and the sync phone tier
  then propagates that merge to every machine. A null phone is unusable; a fake phone eats other records.
  **Phase O** — checked before building: **15 Aug already ships** (one of five seeded built-ins with
  bilingual greeting + invitation templates and bulk send), and **Foundation Day already works** as a
  fixed-date custom occasion. Real gap found instead: **not one seeded occasion is a festival**, and
  `Occasion` holds only `month`/`day`, so lunar-calendar festivals cannot be represented — while two
  code comments explicitly tell users they can add "movable festivals", which is how a wrong-day Diwali
  greeting reaches hundreds of supporters. Fix is a per-year date table with a hard **never-guess** rule
  and a visible "needs a date" state; **no lunar library**, and **no festival dates typed from model
  memory** — they are almanac-sourced and owner-confirmed, because inventing them is the exact harm the
  phase exists to prevent. Still no feature code written.

---

## GRILLING OUTCOMES — ROUND 3 (G18–G24), 2026-08-20 · deployment readiness

> Third `/grilling` pass. Rounds 1–2 grilled the feature and the rollout; this round asked the
> narrower question **"once built, is this actually deployable to four Windows laptops and 2–3
> Android phones?"** Seven decisions, three of which came from reading the build output rather than
> from asking.

**G18 — CORE vs switchable. A pilot failure must cost a flag flip, not a re-plan.**
Seven workstreams and one pilot device is an unacceptable coupling. Therefore:

| | Workstream | If it fails on the pilot |
|---|---|---|
| **CORE** | Calendar (B/C/D) · Inbound intake (V) · Complete backup (R0) · Upgrade-in-place (R1) | **Nothing ships.** Fix and re-pilot. |
| switchable | Native file I/O (F) | build flag off → text route only, which is today's behaviour |
| switchable | Plan sharing (S) | build flag off → plans stay device-local, as originally designed |
| switchable | Digest opt-in (U1/D1/G15) | offer removed from the what's-new card |
| switchable | Festival dates (O1–O4) | fixed occasions keep working exactly as they do today |

Every switchable workstream gets an **independent build-time flag, default on**, wired in Phase A-style
before its own implementation begins. ~half a day total.

**G19 — Mixed-version window: every shared message carries a human-readable header (new S10).**
`SyncService.merge()` throws `"Invalid sync package: No visitor data found"` when `data.visitors` is
absent (`SyncService.js:88`) — and a "Send plans" payload has no `visitors`. So the first time an
upgraded phone sends plans to one that has not upgraded, that volunteer sees a technical English error
and concludes the feature is broken. **Verified fix is free:** `parseChunks` scans with a regex
(`TextSyncService.js:157`), so **any text around the sync block is ignored**. Every shared message is
therefore prefixed with a plain line — *"📅 Dnyani Mitr — Tuesday's plans (3 visits). Needs app version
3.2.0 or later."* — which the human reads **before** pasting. Additionally: **do not announce
plan-sharing until the whole fleet is upgraded** (days, at 6–7 devices). The header stays valuable
permanently: it tells a recipient what a wall of base64 actually is.

**G20 — Laptops standardize on Chrome or Edge (new R2.6).** Chrome/Edge share a single storage area
across `file://` pages, which largely defuses the "wrong copy" failure (R2.5/G16). Firefox handles
`file://` origins differently and **I will not design around behaviour I have not tested** — so the
guide names Chrome or Edge, and the pilot laptop confirms real storage behaviour with real data before
anyone else upgrades. Turns a three-browser matrix into one. Any existing Firefox user is migrated
deliberately: export → switch → import.

**G21 — There is no downgrade; recovery is two-layered (new R3).** `versionCode` 11 > 10 and Android
refuses to install downward, so once v3.2.0 lands it cannot be reverted without uninstall-and-restore
— on a rollout that deliberately has no backup gate. Two layers instead:
1. **User-flippable in-app switches, no rebuild required.** `landingScreen` already does this (S5);
   the digest and file-sharing get the same. "The new screen confuses me" is then fixable over the
   phone in ten seconds.
2. **Staged broadcast with a soak.** Pilot → **wait 48 hours** → everyone else. At 6–7 devices a bad
   release reaches one person instead of all of them.
A v3.1.0 APK + uninstall/restore runbook is documented as the catastrophic-case escape only — it
destroys local data and is never the first tool reached for.

**G22 — Bus factor closed before the release, not after (new R1.7).** This laptop is currently the only
machine that can build **and** the only holder of the key that can upgrade the fleet. Three steps, this
week: keystore off-machine and encrypted (R1.2); the exact build sequence written as a runbook (Node,
Java 21, `cap sync`, `gradlew`, `verify-apk`); and **someone follows that runbook end-to-end on a second
machine** — a runbook nobody has executed is a wish, not a procedure. CI-signed releases with the key in
secrets is the correct destination and fixes R-DEFECT-4 properly, but changing how releases are produced
inside the release that changes landing screen + backup format + sync payload is one variable too many.
**Adopt after v3.2.0.**

**G23 — All-satellite NGOs work, but the app lies to them (new U7).** Checked rather than assumed:
`machineRole === 'root'` gates **only labels and one column**, never behaviour — so an NGO with no root
machine loses nothing. But its volunteers read *"Send to coordinator"* and *"Get latest from
coordinator"* when no coordinator exists. Role-neutral copy when the fleet has no root.

**G24 — Three stale facts in the plan and the build, found by inspection.**
(a) **`RESUME.md` does not exist** — this plan and its predecessors instructed "refresh the stale
RESUME.md". E3 corrected to *create* it.
(b) **`dist/` is three files, not one** — `index.html`, `manifest.json`, `sewa-sankalp-logo.png.png`;
`index.html` links `./manifest.json`. So "just replace index.html" must be **verified on the pilot
laptop**, not assumed, and R2.1's instruction states exactly which files to copy.
(c) **The PWA manifest icon path is broken** — `manifest.json` points at `assets/sewa-sankalp-logo.png`
while the file ships as `sewa-sankalp-logo.png.png` at the root. Cosmetic (PWA install only), fixed in
passing.

**Non-blocking observation (not a task).** Activation is a soft gate: `SSP-DEV1-2026-TEST` is hardcoded
as always-valid in `crypto.js` and is the key printed in `docs/laptop_only_deployment_guide.md`, so the
existing laptops run on the dev key. There is no per-NGO key issuance, expiry or revocation. Irrelevant
to this release; relevant if the NGO count grows.

## New tasks from round 3

- **S10 (G19)** Human-readable header line on every shared message + hold the plan-sharing announcement
  until the fleet is upgraded. Test that the parser still decodes with the header present.
- **R1.7 (G22)** Keystore off-machine + written release runbook + **proven on a second machine**.
- **R2.6 (G20)** Guide names Chrome/Edge; pilot laptop verifies `file://` storage survives the overwrite
  with real data; deliberate migration path for any Firefox user.
- **R3 (G21)** User-flippable switches for digest + file-sharing (landing already has one); staged
  broadcast with a 48-hour soak; v3.1.0 + uninstall/restore runbook documented as last resort.
- **U7 (G23)** Role-neutral sync copy when the fleet has no root machine.
- **E0 (G18)** Wire the four build-time feature flags before their workstreams begin.
- **E3 (G24)** Create `RESUME.md`; state exact laptop file-copy instructions; fix the manifest icon path.

## Progress log (append-only) — continued

- 2026-08-20 — **Third grilling pass complete (G18–G24), focused on deployment readiness. Still no
  feature code.** Established a **CORE** (calendar, inbound intake, complete backup, upgrade-in-place)
  that gates the release, with the other four workstreams behind independent build-time flags so a
  pilot failure costs a flag flip rather than a re-plan. Three findings came from reading the build and
  the source rather than from asking: a plans-only payload makes a **not-yet-upgraded device throw a
  meaningless English error** (fixed free, because `parseChunks` ignores text around the sync block, so
  every message now carries a human-readable header); **`dist/` is three files, not one**, so the laptop
  "replace index.html" instruction must be verified rather than assumed, and the PWA manifest icon path
  is broken; and **`RESUME.md`, which three plans have instructed someone to "refresh", has never
  existed.** Also confirmed by inspection that **all-satellite NGOs lose no functionality** — `isRoot`
  gates only labels — but are shown coordinator-centric copy that is false for them. Closed the two
  operational risks that would have surfaced at the worst moment: **no downgrade exists**, so recovery
  is user-flippable in-app switches plus a staged broadcast with a 48-hour soak; and the **bus factor**,
  where one laptop is both the only build machine and the only holder of the upgrade key — fixed by a
  keystore backup and a release runbook that someone must actually execute on a second machine, because
  an unexecuted runbook is a wish. Laptops standardize on **Chrome/Edge**, verified on the pilot, because
  Firefox's `file://` storage behaviour is something I declined to design around without testing it.

---

## SIMPLIFICATION DECISION — pilot scale (owner-raised, decided 2026-08-20)

**Context.** Only **3 NGOs** are live on this app as a pilot. The owner offered to ask each to take a
backup and **verify that backup works with the updated version**, and asked whether that lets the plan
be simplified, or whether to hold the line and review once more before executing.

**Decision: accept the offer AND keep the plan. They are not in conflict.** The trade is process
ceremony for direct human contact at pilot scale — a good trade at three NGOs.

**The offer is stronger than what was planned.** "Make sure the backup works with the updated version"
is a **restore rehearsal on real data on every device**, where E5a specified only a pilot-device test.
It supersedes the weaker check. **Sequencing dependency:** a backup cannot be verified against v3.2.0
until v3.2.0 exists — so the order is **build → prove backup+restore on the pilot → collect verified
backups from all 3 NGOs → broadcast.** Collecting before upgrading is correct; verifying that they
restore is what must happen on the pilot first.

**Deferred (≈1.5 days saved) — all risk-management, none correctness:**

| Deferred | Rationale |
|---|---|
| **U3** backup-age nudge | The dev team is driving backups directly for 3 NGOs; an in-app 14-day nag is redundant while a human is doing it |
| **U2** coach marks | At 3 NGOs a phone call explains the calendar better than any tooltip |
| **R1.4** release-signing prep | Preparation with no user value this release; do it at adoption |
| **R1.7** second-machine build proof | **Keystore backup (R1.2) stays — non-negotiable, two minutes.** Only the runbook execution defers |
| **E6** volunteer guide | Polished bilingual document with screenshots → one WhatsApp message + 3 calls |

**NOT simplified, and why:**
- **R0 + F0 become MORE important, not less** — the owner's whole proposal rests on them. Today the
  "full" backup silently drops `occasions`/`campaigns`, and on mobile the file path fails while
  displaying *"Backup file downloaded. Store it safely."* **You cannot ask three NGOs to take a backup
  that does not work.** These are built first.
- **Every data-model decision stays** (S2–S7 merge rules, V's occasion/date modelling, O2's never-guess
  rule). **Correctness does not scale with user count.** A festival greeting sent on the wrong day to
  200 supporters is exactly as damaging at 3 NGOs as at 30 — arguably worse, because at pilot scale
  these relationships are what the product is being judged on.
- **G18 build-time flags stay**, but as a plain constants object, not a framework. They are what lets
  CORE ship when MIUI file-sharing turns out broken.

**The honest number: ≈1.5 days saved out of ≈8.** Worth stating plainly — **this release is not large
because of ceremony, it is large because seven real defects were found**: a backup that is not full, a
restore that cannot restore from a file, an export that lies about succeeding, festivals that fire on
the wrong day, an unbacked-up signing key, a CI pipeline emitting uninstallable APKs, and a "visit" that
meant the wrong thing. Scaling down process does not shrink defect repair, and none of these repairs
get cheaper by waiting.

**RE-ENTRY CONDITION (the deferral is conditional, not permanent).** U2, U3, R1.4, R1.7 and the full E6
return when **either**: (a) a **fourth NGO** is onboarded, or (b) **any device is upgraded without a
human on the call**. Those five items are precisely the machinery that substitutes for the human who
will not be there. This trigger is recorded so the debt is repaid on a condition, not on someone
remembering.

## Progress log (append-only) — continued

- 2026-08-20 — **Simplification decision taken at owner's prompt; plan otherwise held.** Owner disclosed
  the true scale — **3 pilot NGOs** — and offered supervised backup + restore verification in exchange
  for simplification. Accepted, because the offer is **strictly stronger** than the planned check (a
  restore rehearsal on real data on every device, versus a pilot-only test) and because it effectively
  restores the backup gate declined in G7, through the front door. Five risk-management items deferred
  (U2, U3, R1.4, R1.7's second-machine proof, and the polished E6 guide) for ≈1.5 days; **no correctness
  work cut**. R0/F0 explicitly *promoted* rather than reduced, since the owner's own proposal is
  unexecutable until the backup actually works and stops falsely reporting success. Recorded the
  sequencing dependency the offer implies (a backup cannot be verified against v3.2.0 before v3.2.0
  exists) and a **conditional re-entry trigger** — fourth NGO, or any unsupervised upgrade — so the
  deferred machinery returns on a condition rather than on memory. Key finding stated for the record:
  simplification saves ≈1.5 of ≈8 days, because this release is **defect repair, not ceremony**. Still
  no feature code written; plan is ready for the owner's final review before execution.

---

## Progress log (append-only) — continued

- 2026-08-20 — **PHASE B COMPLETE (B0–B6). Gate green: `vitest` 226/226 (16 files) · `vite build`
  380.17 kB / 136.44 kB gzip clean.** Baseline 378.82 kB; S8 ceiling 420 kB — 1.35 kB spent in total.
  **Pre-review found two real defects before a line of Phase B was written, both fixed as B0:**
  **(1) A6 was incomplete and would have silently resurrected closed follow-ups.** `storage.js` gained
  `followUpCompletedAt`, but `Interaction`'s constructor and `toJSON()` never declared it — so any
  round-trip through `fromJSON`/`toJSON` dropped a completed follow-up and it would reappear as open,
  forever. No live path does that round-trip *today*, which is exactly why it would have shipped: C4
  sets the field and Phase S round-trips records. Model now declares and serialises it.
  **(2) `ScheduledItem` had no `direction`, so G10-R was unbuildable.** The day pane must lead with
  inbound, but nothing could distinguish inbound from outbound. Added now rather than in Phase V,
  defaulting to `outbound` (every pre-V item is a volunteer's own plan), with a `storage.js` back-fill
  because plain objects from storage or a future sync bypass the constructor.
  **B2/B4 promotions.** `_annotateHandled` → `annotateHandled` and `_generateFrequencyReminder` →
  `generateFrequencyReminder`, with the old names kept as delegating aliases. CalendarService reuses
  both instead of forking (G6); the 198 pre-existing tests stayed green **unchanged**, which is the
  no-regression proof.
  **`src/services/CalendarService.js` (new, ~380 lines, owns no state).** `getItemsForRange` resolves
  annual events into whatever year is asked for via `resolveAnnualDate` — the thing `Reminder` cannot
  do, because it normalizes to the current/next year at construction. A `Reminder` is still built per
  event, but **only to obtain the canonical id and the handled annotation**; its normalized date is
  discarded. The id is year-independent (hash of visitor+contact+type+rawDate), so annotation stays
  correct across years. Seven item kinds: event, contactDue, occasion, campaign, followUp, interaction,
  scheduled. `getMonthMatrix(year, month)` takes a **1-12 month, deliberately not** the 0-11 index
  `getRemindersForMonth` takes. `getOverdueBacklog()` returns the full list plus a total so the UI caps
  at 5 (G17).
  **Design decisions worth recording:** month-only events go to a `monthWide` bucket and are never
  pinned to the 1st (F10); contact-due is a one-off target date and is **never annualised**; logged
  interactions are always `handled` (a record of fact, not an action); do-not-contact visitors are
  excluded from derived reminders but still appear via their own interactions and scheduled items;
  stored event dates are parsed **textually** when they look like `YYYY-MM-DD`, because
  `new Date('1985-08-15')` is UTC midnight and lands on the previous local day in any negative-offset
  timezone.
  **KNOWN DIVERGENCE, deliberate and documented.** For a 29-Feb event in a non-leap year the calendar
  shows **28 Feb** (`resolveAnnualDate` clamps, matching `OccasionService`) while the Reminders tab
  shows **1 Mar** (`normalizeEventDate` overflows). Both behaviours are pinned in the characterization
  suite; the divergence is pre-existing and now visible on two surfaces. Clamping is the correct
  reading for an Indian NGO — a 29-Feb birthday is observed on the 28th, not in March. Fixing
  `normalizeEventDate` means deliberately retiring a frozen characterization expectation, so it is
  **deferred to a later iteration**, not smuggled into this one. Affects only 29-Feb people in non-leap
  years.
  **`tests/calendar-service.test.js` — 28 tests, green first run**, TZ-pinned to Asia/Kolkata with fake
  timers at 2026-08-20 12:00 IST: future and past year resolution, Dec→Jan rollover, 29 Feb in both
  leap and non-leap years, month-only diverted, DND excluded, campaign stored as a full timestamp, open
  vs completed vs legacy-missing follow-up, an interaction at 21:00Z landing on the **next** local day,
  contact-due not repeating annually, inbound sorted ahead of outbound, legacy items defaulting to
  outbound, denormalised visitor name for an unknown visitor, 6×7 matrix in both week starts, leap
  February, unhandled-past flags, and backlog ordering/exclusions.
  **Next on the critical path: R0 — complete backup + working restore (GATE).** Nothing committed.

- 2026-08-20 — **R0 COMPLETE — THE GATE IS GREEN. `vitest` 237/237 (17 files) · `vite build`
  382.68 kB / 137.01 kB gzip.** An APK may now reach a device: the rollout's fallback (back up →
  uninstall → install → restore) actually works, and `tests/backup-restore.test.js` (11 tests) is the
  proof.
  **R0.1** `SyncService.prepareFullBackup()` — one authoritative payload carrying all nine collections
  plus a `metadata.collections` manifest. `SyncManager` no longer assembles its own; building it in the
  component is exactly how `occasions` and `campaigns` went missing from a package stamped `'full'`.
  **R0.2** `restoreFullBackup()` — replaces rather than merges, snapshots first, refuses a sync package
  with a message saying what to use instead, refuses a damaged package **without wiping the device**,
  and runs the result through `ensureForwardFields` so a v3.1.0 backup lands cleanly in v3.2.0.
  **R0.3** The file-import path now detects `backupType: 'full'` and routes to restore behind a
  visibly different, `danger`-typed question — *"This REPLACES everything"* versus sync's *"Merge into
  your current list"*. Previously a full-backup file fell through to `merge()`, which reads three
  collections, drops six, and reports success: the safest-looking action a careful user could take was
  the one that lost their data.
  **R0.4** Round-trip proof: populate every collection (Devanagari, a 29-Feb dob, a custom occasion, a
  campaign, an inbound scheduled item, a snoozed action, non-default settings) → backup → **wipe to a
  fresh install** → restore → deep-equal on every collection, and it survives a reload.
  **R0.5** The bug-class guard: the backup's key set must equal `getDefaultState()`'s minus a
  documented five-key exclusion list (`version`, `activated`, `machineId`, `machineRole`,
  `machineName` — a restore must never steal the sender's device identity). Any future collection
  added to state without being added to the backup now **fails the suite**.
  **DEFECT FOUND BY THE TEST, not by review — absent ≠ empty.** The first implementation wrote
  `occasions: []` when a package had no `occasions` key. But `ensureForwardFields` reads an empty array
  as *"the user deleted them, do not reseed"* — so restoring a genuine v3.1.0 backup (which carries no
  such key, precisely because of R-DEFECT-1) would have left the device with **zero occasions**,
  silently, while reporting a successful restore. Fixed: a key that is **absent** is left untouched, so
  built-ins seed on a fresh install and an existing device keeps what it has; a key that is **present,
  even as `[]`**, is an instruction and is honoured. This is the same class of defect R0 exists to fix,
  found one layer deeper.
  **Next: F0 — stop `saveFile()` reporting success it cannot verify.** Nothing committed.

- 2026-08-20 — **F0, E0, Phase O, Phase V (model), Phase C COMPLETE. `vitest` 274/274 (19 files) ·
  `vite build` 427.04 kB / 148.76 kB gzip.**
  **⚠ S8 BUDGET BREACHED — 427.04 kB against a 420 kB ceiling.** Reported, not silently passed. The
  ceiling was set when this was a one-workstream release; it now carries seven, four of them added by
  owner decision after the ceiling was written. **Recommend raising S8 to 460 kB** with this entry as
  the rationale. Gzip — what actually crosses the wire and matters on a low-end phone — is 148.76 kB.
  **F0** `saveFile()` no longer claims success it cannot deliver: on Capacitor it returns
  `{method:'unavailable'}` with a reason instead of running an anchor download that is a silent no-op,
  and the backup screen now says *"No file could be saved on this phone. Use Backup as message — that
  always works."* in place of *"Backup file downloaded. Store it safely."* That message was the most
  dangerous string in the app.
  **E0** Four build-time flags in `constants.js` (`nativeFiles`, `planSharing`, `dailyDigest`,
  `movableOccasions`). CORE carries none — if CORE fails, nothing ships (G18).
  **Phase O** `Occasion` gains `movable` + a per-year `dates` table; `resolveFor(year)` returns null
  rather than guessing, `needsDateFor(year)` drives the O4 "needs a date" state, and
  `OccasionService.nextOccurrence` is movable-aware. **10 occasions seeded**: 4 more fixed civic/
  religious dates with real dates (Makar Sankranti, Shiv Jayanti, Ambedkar Jayanti, Christmas) and
  **6 movable festivals by NAME ONLY with an empty table** (Gudi Padwa, Holi, Ganesh Chaturthi,
  Dussehra, Diwali, Eid) — no lunar date was written from model memory, per O3. Both lying comments
  corrected. 17 tests.
  **Phase V (model layer)** `ScheduledItem` gains `phone`, `visitorName`, `headcount`, `purpose`,
  `occasion{type,whose,relation,date}` and `outcome`. The occasion's own date is stored **separately
  from the visit date**. Validation accepts an explicit null phone but rejects a short one.
  **Phase C** `components/Calendar/` — `CalendarView` (6×7 grid, month nav, density dots, month-wide
  band, deep link `#/calendar?date=`), `DayPane` (**Coming to us → Needs catching up → We are going →
  On this day**, per G10-R), `ScheduledItemForm` (phone-first intake with live identity resolution,
  occasion capture, "caller didn't give a number" storing **null**). Completion is one tap; an inbound
  item asks *"Did they come?"* first, and **only a visit that happened writes an Interaction** (V7).
  Creating an inbound visit for an unknown number creates the supporter **and** the third-party contact
  carrying the occasion date, so the existing reminder engine carries it forward every year (V4).
  Route `#/calendar` registered, nav reads **Calendar | My Day**, and `setDefaultRoute` honours the
  `landingScreen` setting — the C5a/S5 kill switch, flippable from Settings with no rebuild.
  **20 render tests** including day-pane ordering, the G17 cap, escaping of user text, and the
  full intake→supporter-creation path.
  **REMAINING, not started:** Phase S (selective plan export), Phase U (what's-new card, role-neutral
  copy), Phase D (digest, cross-link, escape sweep), Phase F1–F4 (native file I/O — unverifiable
  without a device), R1/R2/R3 (version bump, verify script, staged broadcast), Phase E (docs, review,
  APK, pilot). Nothing committed.

- 2026-08-20 — **Phase S, Phase U, Phase D, and E2 COMPLETE. `vitest` 292/292 (20 files) ·
  `vite build` 435.60 kB / 151.48 kB gzip.** (S8 breach previously reported; see the raise
  recommendation above.)
  **Phase S — shareable plans, 18 tests, green first run.** `preparePlansExport()` carries plans
  from today forward plus **visitor STUBS** (id/name/phone only — never the full record, so private
  notes stay home and no half-people enter the receiver's list). Cancellations travel for 30 days as
  tombstones (S4): sync has no delete propagation, which is fine for visitors and fatal for plans —
  if the office cancels Tuesday and the cancellation never lands, the volunteer makes the trip.
  `mergePlans()` implements the three rules a naive LWW gets wrong: **`done` is terminal** (an
  incoming edit may change a title, never un-complete recorded work), **re-import and stale import
  are no-ops** (forwarding the same WhatsApp message twice is normal behaviour, not an edge case),
  and a **same-person same-day duplicate is flagged, not silently doubled** (no authority exists in an
  all-satellite NGO). `plansMessageHeader()` supplies the S10 human-readable line. **Measured:
  a 15-plan week encodes to exactly ONE WhatsApp message** — asserted in the suite, so a future change
  that bloats the payload fails the build rather than surprising a volunteer.
  **Phase U** — `WhatsNew` card shows once per minor release, Marathi-first, explaining that the
  landing screen moved and that My Day still exists; it carries the **digest opt-in (G15)** so the
  Android permission prompt arrives with a reason attached. Correctly shows nothing on a *fresh*
  install — there is no "new" without an "old". **U7 (G23):** an all-satellite NGO with no root
  anywhere in the fleet now reads "Send to another device", not "Send to coordinator" — which was
  simply false for them.
  **Phase D** — D1: the daily digest now **leads with today's plans** ("3 planned today, 2 due
  today"), guarded by the `dailyDigest` flag and wrapped so a calendar error can never break the
  notification. D2: My Day links back to the calendar, closing the round trip both ways. D3: escape
  sweep over every new component — all dynamic values pass through `escapeHTML`; `Toast` uses
  `textContent` and `ConfirmDialog` escapes internally. **That sweep found a defect I had introduced:**
  the restore dialog double-escaped a machine name, which would render a literal `&amp;`. Removed.
  **E2** — version bumped to **v3.2.0 / versionCode 11** across `package.json`, `constants.js` and
  `variables.gradle`. The versionCode bump is what makes the upgrade installable at all.
  **REMAINING:** F1–F4 (native file I/O — writable but unverifiable without a device), R1 (keystore
  backup, runbook, verify-apk script), R2 (desktop guide + wrong-copy guard), R3 (staged broadcast),
  E1/E3–E7 (docs, adversarial review, APK, pilot). Nothing committed.

- 2026-08-20 — **Phase F, R1, R2.5, R3 COMPLETE. `vitest` 308/308 (21 files) · `vite build`
  440.87 kB / 153.18 kB gzip.**
  **Phase F — native file I/O.** `@capacitor/filesystem@8` + `@capacitor/share@8` installed and reached
  through `window.Capacitor.Plugins` at **runtime**, the same pattern SmsService and
  NotificationService already use — nothing is statically imported, so the web bundle and the
  single-file `file://` desktop build are untouched and the browser build's zero-dependency rule
  survives. `FileService.shareFile()` writes to CACHE and shares the `content://` URI through the
  FileProvider Capacitor had **already configured** — precisely what MIUI/ColorOS do not break, where
  raw storage writes are what they do break. `saveToDevice()` (F2) leaves a keepable copy in
  Documents so a backup exists even if the share sheet is dismissed.
  **F3 — the actual unlock.** Intent filters for `ACTION_VIEW`/`ACTION_SEND` on `application/json`,
  handled in `MainActivity`: the content is read natively (the WebView cannot read a `content://` URI
  granted to the Activity), handed over as a `dnyanimitr:file` event, and **parked on `window` for a
  file that LAUNCHED the app**, which always arrives before any listener exists. `SyncManager` feeds
  it into the SAME preview + confirm flow a picked file uses — no second import path to keep correct.
  Tap the attachment in WhatsApp, pick Dnyani Mitr, done: no picker, no folder hunting.
  **F4** `WebView.setDownloadListener` registered; a `blob:` URL is logged rather than silently
  ignored, since DownloadManager cannot fetch one.
  **16 tests — and the limit is stated honestly in the file header:** none of them says anything about
  whether MIUI actually honours a share intent. What they pin is the contract around it — degrade
  honestly when plugins are absent, never claim a file that was not written, treat a dismissed share
  sheet as success and a real error as failure, and correctly drain a launch-time file.
  **R1.6** `scripts/verify-apk.sh` — prints the APK's signer SHA-1, compares it to the expected
  fingerprint, and refuses with an explanation. **Run against the existing APK: ✓ matches.**
  **R1.5** CI artifact renamed `app-debug-CI-TESTING-ONLY.apk`, with a job-summary warning explaining
  that the runner regenerates a throwaway keystore every run and that handing this to a volunteer
  forces an uninstall.
  **R2.5 (G16)** Wrong-copy guard on the activation screen: *"Already using Dnyani Mitr and seeing this
  screen? You have opened a different copy of the file…"* — catching the laptop failure at the second
  it happens, before anyone types data into a second divergent database. Version string on that screen
  also fixed: it had read a hardcoded "Version 2.0" since v2.
  **R3** Settings now carries the **opening screen** switch (Calendar / My Day) and **week starts on**
  — user-flippable, no rebuild, which is the only rollback that exists once an APK is installed.
  **REMAINING:** E1/E3–E7 (docs, RESUME.md, adversarial review, APK build, device pilot), R1.2
  keystore backup and R1.7 runbook (owner actions), R2.1/R2.2 desktop guide. Nothing committed.

- 2026-08-20 — **E4 ADVERSARIAL REVIEW COMPLETE. `vitest` 314/314 (21 files) · `vite build`
  440.97 kB / 153.26 kB gzip.** Stated plainly: this was a **self-review**, which is subject to
  confirmation bias because the same author wrote the code. Independent review (`/code-review ultra`)
  is owner-triggered and has not been run. Four findings, each reproduced by a failing test first.
  **E4-1 (correctness, real) — merged plans lost the sender's edit time.**
  `StateManager.updateScheduledItem` stamps `updatedAt: new Date()` **after** the spread, so
  `mergePlans`' `updatedAt: item.updatedAt` was silently discarded. Consequence is not cosmetic: it
  breaks last-write-wins across three machines — A edits, B imports and re-stamps with its own clock,
  B relays to C, and C now compares against B's *import* time, so a genuinely later edit from A can
  lose to an earlier one that was merely relayed. It also broke idempotency under sender clock skew,
  which is ordinary on cheap phones with no NTP: re-importing the same update re-applied every time.
  Fixed with an explicit `preserveUpdatedAt` parameter; two regression tests.
  **E4-2 (security, real) — a new ingestion path wrote unvetted objects into state.** `mergePlans`
  stored incoming items directly: no model normalisation, no day-key validation. A corrupted or
  hostile message could set unknown enum values (a bogus `status` makes an item silently invisible,
  since anything other than `planned` counts as handled), carry arbitrary extra fields that would then
  be **re-exported onward to the next device**, or place an item on a date the calendar cannot render.
  Now normalised through `new ScheduledItem(...)` and rejected unless the date is a real day key.
  Four tests, including a hostile-enum case.
  **E4-3 (PII, disclosed not fixed — it is the feature working).** A plans message now carries
  `phone`, `visitorName`, and `occasion.whose` + `occasion.date` — which in the daughter's-birthday
  scenario is **a child's name and date of birth**, travelling over WhatsApp; `visitorRefs` carries
  phone numbers too. Plans did not travel at all before this release, so this is a genuinely new PII
  surface. Not a defect, but it must not be silent: the Send-plans panel now states what the message
  contains and that it should go only to people inside the organisation.
  **E4-4 (quality) — V10 was claimed but not implemented.** `ScheduledItemForm` passed
  `source: 'phone-intake'` to `new Visitor(...)`, but the model never declared the field, so it was
  dropped. "Phone-intake records are marked and reviewable" was therefore false. `Visitor.source`
  added and serialised. Also removed four dead imports the review surfaced.
  **Checked and found sound:** `VisitorService.getAll()` excludes soft-deleted visitors, so the
  calendar cannot surface a deleted person's birthday. `_seedOccasions` deep-clones, so the new
  `movable`/`dates` fields survive seeding. `Toast` uses `textContent` and `ConfirmDialog` escapes
  internally — and that check caught a **double-escape I had introduced** in the restore dialog.
  Every dynamic value in the new components passes through `escapeHTML`, verified by grep and by a
  stored-markup test in `calendar-ui`.

- 2026-08-20 — **E2/E3 DONE + ANDROID BUILD VERIFIED. Iteration 11 is code-complete.**
  **`vitest` 314/314 (21 files) · `vite build` 441.23 kB / 153.36 kB gzip · `cap sync` clean (3
  plugins) · `./gradlew assembleDebug` SUCCEEDED · `./scripts/verify-apk.sh` ✓ signature matches.**
  **The Android build is the important one here**, because Phase F added Java that had never been
  compiled. It compiles. Verified in the merged manifest: `versionCode="11"`, `versionName="3.2.0"`,
  the F3 `application/json` intent filters present (3 occurrences), `POST_NOTIFICATIONS` merged in
  from the local-notifications plugin, and the FileProvider intact. The web assets inside the APK
  report 3.2.0. Local JDK is 17, so the build was run with an explicit
  `JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64` — worth recording, since `./gradlew` fails on the
  default JDK here.
  **E3 docs:** `PROJECT_PLAN.md` §3 carries the Iteration 11 entry, with the known limits stated
  rather than hidden (Phase F unverifiable off-device, the 29-Feb divergence, the bundle ceiling, and
  that the adversarial review was a self-review). **`RESUME.md` CREATED** — the file three successive
  plans instructed someone to "refresh" and which had never existed. It carries the 10-step laptop
  acceptance walk, the build commands, and the open owner actions. **`CLAUDE.md` corrected:** its
  claim that `assembleRelease` "requires keystore.properties" was false — there is no `signingConfig`
  anywhere in `android/`, so release builds are unsigned and unusable; the note now says so and
  points at `verify-apk.sh`.
  **⚠ PUSHING TO GIT WILL PRODUCE A NON-DISTRIBUTABLE APK.** The CI runner regenerates a debug
  keystore every run, so its artifact cannot install over the apps on the NGO devices. CI proves the
  Android build compiles; that is all, and the artifact is named to say so. **The distributable APK is
  the one just built on this laptop** — it is signed with the key already on those devices, and
  `verify-apk.sh` confirms it.
  **REMAINING:** E5a pilot (one phone + one laptop, 48-hour soak), E6 volunteer instructions, and the
  owner actions in `RESUME.md` — chiefly backing up the keystore and sourcing the festival dates.
