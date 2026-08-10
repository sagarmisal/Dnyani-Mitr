# Evolution Initiative — Detailed Execution Plan (Iter 10 → 12)

> Owner: Claude (accountable for reliable, end-to-end delivery).
> Created 2026-06-02. This is the canonical PLAN + append-only progress log for the
> "Reach → Plan → Polish" roadmap. Resume from THIS file. Verify against live code (code > docs).
> Companion: `VERSION_3_VISION.md §6` (what/sequence) · `PROJECT_PLAN.md §3` (history, updated per iteration).

## Roadmap

| Iter | Theme | Headline | Version target |
|------|-------|----------|----------------|
| 10 | The Reach Release | Bulk Occasion **Campaigns** (user-manageable occasions + templates) + **local notifications** | v3.1.0 / vc 10 |
| 10.5 | Reach tail | B3 post-comm auto-log polish + F-Contacts phone import | v3.1.1 / vc 11 |
| 11 | The Field Release | Visit Planner by City | v3.2.0 / vc 12 |
| 12 | The Polish Release | Design-language elevation (UX-6) | v3.3.0 / vc 13 |

Additive-first: every task leaves the app building, tests green, `cap sync` clean.

## Decisions locked (owner-confirmed)
- Channels: **SMS bulk (native SIM) + WhatsApp per-contact** (ban-safe). Large lists default to SMS.
- Occasions: seeded fixed-date defaults **+ user can add/edit/delete occasions and set per-occasion templates**.
- Templates: **bilingual (Marathi + English)**, authored by us. Org sign-off tagline = **`चला जरा वेगळे जगुया ...`** via `{tagline}` token.
- Seed occasions: Republic Day (26 Jan), Independence Day (15 Aug), Gandhi Jayanti (2 Oct), Maharashtra Day (1 May), New Year (1 Jan). [Foundation Day: PENDING owner date.]
- Every campaign send **creates an Interaction per recipient** (core data-flow rule). `doNotContact` always excluded; "consented-only" optional.
- Movable festivals (Diwali/Holi/Eid/Ganesh) → user creates a custom dated occasion/campaign that year.

---

## Universal per-task checklists (apply to EVERY task)

**Definitions.** *Correctness* = specified result for valid inputs, honors every consumer contract, proven by a test. *Robustness* = survives invalid/edge/adversarial input (empty, null, max-length, Devanagari, year/leap boundaries) without crashing, fails safe, idempotent where required. *Reliability* = deterministic, persists across reload/WebView-kill/restart, backward-compatible, offline-safe, zero regression to existing tests.

**PRE-task:** (1) read live source of every file touched + signatures of anything consumed (code > docs); (2) confirm prior task's gate passed (build/tests green); (3) enumerate this task's edge/adversarial inputs; (4) confirm not disturbing Iter 9.5 staged files / backups; (5) restate acceptance criteria.

**POST-task:** (1) `vite build` clean; (2) `vitest run` all green (existing + new); (3) new behavior tested; migration/model change null-safe + idempotent + v3.0.7-fixture tested; (4) data-flow rule (sends log Interactions) + consent/DND honored where relevant; (5) Devanagari safe, no secrets/PII to console/UI; (6) `cap sync` clean if web/native changed; (7) sync export→import round-trip still works with new state keys; (8) adversarial self-read of diff + append progress-log line.

## Data model & migration (v3.0.7 → v3.1.0)

### New state collections
- `state.occasions: []` — seeded on upgrade from `DEFAULT_OCCASIONS`. Record:
  `{ id, name, nameMr, month (1-12), day (1-31), builtin (bool), templates: { greeting: {en, mr}, invitation: {en, mr} }, createdAt, updatedAt }`
  Built-ins use stable ids (`occasion_republic_day`, …) so future seed additions merge by id; built-in template edits persist.
- `state.campaigns: []` — Record:
  `{ id, name, occasionId|null, channel ('sms'|'whatsapp'|'both'), language ('mr'|'en'), messageTemplate (string w/ tokens), date (ISO), recipientFilter { scope:'all'|'filtered', city?, category?, tag?, consentedOnly (bool) }, recipientIds: [] (snapshot at send), status ('draft'|'sending'|'sent'|'partial'|'cancelled'), stats: { total, sent, failed, skipped }, createdAt, sentAt, createdBy, updatedAt }`

### New settings fields
`taglineMr` (default `चला जरा वेगळे जगुया ...`), `taglineEn` (default ''), `notificationsEnabled` (false), `notificationDigestTime` ('09:00'), `defaultCampaignLanguage` ('mr').

### Token system (extend)
`{name}` `{org}` `{volunteer}` `{occasion}` `{tagline}` — substituted at compose time.

### Migration — CRITICAL
`storage.js` currently SKIPS field migration on same-major upgrades (v3.x→v3.x just re-stamps version). **Must add an idempotent "ensure forward fields" step that runs regardless of major version** so the live v3.0.7 install (25 real Marathi visitors) gains `occasions` (seeded), `campaigns` ([]) and the new settings without data loss. Null/default-safe; re-runnable.

---

## Default templates (authored bilingual; samples — full set in `constants.js`)

- Republic Day — greeting (mr): `{name} जी, प्रजासत्ताक दिनाच्या हार्दिक शुभेच्छा! 🇮🇳 — {org}\n{tagline}`
- Republic Day — greeting (en): `Happy Republic Day, {name}! 🇮🇳 Warm wishes from {org}.\n{tagline}`
- Birthday cluster — greeting (mr): `{name} जी, वाढदिवसाच्या मनःपूर्वक शुभेच्छा! 🎂 — {org}\n{tagline}`
- Generic invitation (mr): `{name} जी, {org} तर्फे आपणास सादर निमंत्रण. कृपया उपस्थित रहावे. 🙏\n{tagline}`
- Generic invitation (en): `Dear {name}, {org} cordially invites you. Your presence is requested. 🙏\n{tagline}`

(Invitation specifics like date/venue are edited free-text in the builder, pre-filled from the template.)

---

## ITERATION 10 — sequenced tasks

Each task: **Goal · Files · Depends · Gate**. Gate = must pass before next task.

### Phase A — Data layer
- **T10.1 — Constants & seeds.** Goal: add `DEFAULT_OCCASIONS`, generic greeting/invitation templates, new `DEFAULT_SETTINGS` fields, `{tagline}`/`{occasion}` tokens. Files: `src/utils/constants.js`. Depends: —. Gate: build clean.
- **T10.2 — Campaign + Occasion models.** Goal: `src/models/Campaign.js` (null-safe ctor, `updatedAt`), occasion factory/validator helper. Files: `src/models/Campaign.js`, `src/models/Occasion.js`. Depends: T10.1. Gate: build clean.
- **T10.3 — State + storage + migration.** Goal: `occasions`/`campaigns` in `getDefaultState`; StateManager CRUD (`getOccasions/addOccasion/updateOccasion/deleteOccasion`, `getCampaigns/addCampaign/updateCampaign`) + events; **idempotent forward-migration** seeding occasions & defaulting campaigns/settings on same-major upgrade. Files: `src/core/state.js`, `src/core/storage.js`. Depends: T10.2. Gate: migration unit test (v3.0.7 fixture → fields present, idempotent on re-run); build + tests green.

### Phase B — Services
- **T10.4 — OccasionService.** Goal: next-occurrence math for fixed days (this/next year), "upcoming occasions within N days", birthday-cluster suggestion (reuse `ReminderService`), CRUD pass-through. Files: `src/services/OccasionService.js`. Depends: T10.3. Gate: unit tests (next-occurrence across year boundary; leap-day 29 Feb guard).
- **T10.5 — CampaignService.** Goal: build recipient list via `SearchService.filter` (all + city/category/tag), **always exclude `doNotContact`**, optional `consentedOnly`; per-recipient token substitution; create/save Campaign; orchestrate send; **log one Interaction per recipient**; update `stats`; mark status. Files: `src/services/CampaignService.js`. Depends: T10.4. Gate: unit tests (recipient filtering, consent/DND gating, token substitution incl. `{tagline}`, stats rollup).
- **T10.6 — Send-engine extension (backward-compatible).** Goal: `SmsService.sendBulkNative(items, {onProgress, shouldCancel, composeMessage?, markReminders=true})` — use `composeMessage(item)` if given, skip `recordAction` when `markReminders=false`, always log interaction; `GreetingQueue.start(items, onComplete, {composeMessage?, campaignMode?})`. Default paths unchanged. Files: `src/services/SmsService.js`, `src/components/UI/GreetingQueue.js`. Depends: T10.5. Gate: existing 111 tests still green + new tests for campaign mode (no reminder marking, message override).

### Phase C — UI
- **T10.7 — Occasion management UI.** Goal: Settings (or Campaigns) section to list/add/edit/delete occasions and edit their bilingual templates. Files: `src/components/Campaigns/OccasionManager.js`, wire into `SettingsPage.js`. Depends: T10.3. Gate: desktop render check; create/edit/delete persists.
- **T10.8 — Campaigns screen + route + nav.** Goal: route `#/campaigns`, nav tab, `CampaignList` (upcoming-occasion suggestion cards + past campaigns w/ stats + "New Campaign"). Files: `src/core/router.js`, `src/main.js`, `src/components/Campaigns/CampaignList.js`. Depends: T10.5, T10.7. Gate: nav works, list renders.
- **T10.9 — CampaignBuilder.** Goal: occasion-or-custom-date → channel → language → pick/edit template (live preview w/ a sample recipient) → recipient targeting (All + city/category/tag, live count + excluded count) → confirm → hand off to `SmsBatchQueue` (SMS) / `GreetingQueue` (WhatsApp). Channel auto-recommended by list size. Files: `src/components/Campaigns/CampaignBuilder.js`. Depends: T10.8, T10.6. Gate: end-to-end dry run on desktop (draft → preview → send via SMS stub) creates campaign + interactions.
- **T10.10 — Dashboard surfacing.** Goal: occasion nudge banner on `MyDayDashboard` ("Republic Day in 5 days → 142 beneficiaries → Create campaign"). Files: `src/components/Dashboard/MyDayDashboard.js`. Depends: T10.8. Gate: banner appears within window, hidden otherwise.

### Phase D — Proactive notifications (F-Notif)
- **T10.11 — Local-notifications plugin.** Goal: `npm i @capacitor/local-notifications`, register in `MainActivity.java`, `cap sync`. Files: `package.json`, `android/.../MainActivity.java`. Depends: —. Gate: `cap sync` clean, debug build compiles.
- **T10.12 — NotificationService + settings.** Goal: schedule a daily reminder-digest + upcoming-occasion nudge at `notificationDigestTime`; Settings toggle (`notificationsEnabled`); permission handling; graceful no-op on desktop. Files: `src/services/NotificationService.js`, `src/components/Settings/SettingsPage.js`, `src/main.js` (schedule on launch). Depends: T10.11. Gate: build + tests green; desktop no-op verified.

### Phase E — Harden, verify, ship
- **T10.13 — Test sweep.** Goal: ensure new unit tests cover services; keep suite green (target ≥ 125 tests). Files: `tests/*`. Gate: `vitest run` all green.
- **T10.14 — Version bump + build + sync.** Goal: 3.0.7→3.1.0, vc 9→10 across `package.json`/`constants.js`/`variables.gradle`. Gate: `vite build` clean, `vitest` green, `cap sync` clean.
- **T10.15 — Docs.** Goal: update `PROJECT_PLAN.md §3` (Iter 10 entry) + `VERSION_3_VISION.md §6` (mark done, note scope) + this file's progress log. Gate: docs reflect reality.
- **T10.16 — Adversarial review + security scan.** Goal: parallel review agents on the diff; `/security-review` (PII = beneficiary phones in bulk messaging). Gate: findings resolved or logged.
- **T10.17 — APK + device verification.** Goal: `./gradlew assembleDebug`, install -r, run the device checklist (below). Gate: owner-confirmed on Oppo/Redmi.

---

## Iteration 10.5 (tail) — task sketch
- B3 auto-log polish (confirm every comm path logs; add outcome capture where missing).
- F-Contacts: `@capacitor/contacts` import → map to Visitor/Contact w/ dedupe (reuse phone-normalized two-tier match). Migration-safe. Device-verified.

## Iteration 11 — Visit Planner by City — task sketch
Group active visitors by `Visitor.city`; per-city "field round" view surfacing upcoming events + lapsed visitors; mark-visited → `visit` Interaction; ordering/checklist; offline (no map tiles). Route `#/planner` + nav. Tests for grouping/ordering. Device check.

## Iteration 12 — Design-language elevation — task sketch
Drive with `frontend-design` skill. Coherent token system audit, Devanagari-aware type scale, polished empty/loading/error states, motion, accessibility (≥44px, contrast, focus), apply to UX-6 screen set. Render checks per screen. Device check.

---

## Definition of "production-ready" (applies to each iteration)
1. `npx vite build` clean; `npx vitest run` all green incl. new tests; `npx cap sync android` clean.
2. Migration verified from the live v3.0.x state (no data loss; idempotent).
3. Data-flow rule upheld (sends/visits create Interactions); consent/DND honored.
4. Marathi/Devanagari renders correctly; touch targets ≥44px; no console errors.
5. Adversarial review done; `/security-review` when PII touched.
6. Debug APK built, installed -r, smoke-tested on Oppo + Redmi (device-verified label).
7. Docs (PLAN §3, VISION §6, this log) updated. Owner commits (we don't commit/push unprompted).

## Manual test checklist — Iter 10 (device)
- [ ] Upgrade-in-place over v3.0.7: existing 25 visitors + interactions intact; occasions seeded; no "migrating" error.
- [ ] Campaigns tab present; upcoming occasion suggestion shows correct count.
- [ ] Add a custom occasion + bilingual template; persists across restart.
- [ ] Build a Republic Day SMS campaign → filter city + consented-only → preview correct (name + tagline) → send → each recipient has one SMS Interaction; stats correct; DND/non-consented excluded.
- [ ] WhatsApp campaign on a small segment → per-contact deep-link → "did you send?" → interactions logged.
- [ ] Local notification toggle on → digest fires next day / occasion nudge appears.
- [ ] Marathi text renders correctly in messages and UI.

## Risk register
| Risk | Mitigation |
|------|------------|
| Same-major migration skips new fields | Idempotent forward-ensure step (T10.3) + fixture test |
| Send-engine change regresses reminders | Backward-compatible signatures; keep 111 tests green + new mode tests |
| Personal-SIM SMS carrier caps/DND | Pacing, "X/Y sent" + cap caution, honor consent/DND |
| WhatsApp bulk ban | Per-contact tap-to-send only; recommend SMS for large lists |
| Local notifications unverifiable in-session | Device checklist; desktop no-op guard |
| Large recipient sends long/interrupted | Progress + cancel; recipient snapshot for accurate resume/audit |
| Bulk messaging PII (phones) | `/security-review`; no logging of message bodies/phones to console |

---

## Granular execution checklist (approved 2026-06-02) — track against this

Phase 0: **0.1** baseline verify (build/tests/sync green).
Phase A (data): **A1** constants seeds+occasions · **A2** generic templates+settings+tokens · **A3** Occasion validator · **A4** Campaign model · **A5** state collections+CRUD+events · **A6** idempotent forward-migration · **A7** migration test.
Phase B (services): **B1** OccasionService next-occurrence (leap-safe) · **B2** birthday-cluster+CRUD · **B3** OccasionService tests · **B4** CampaignService.buildRecipients (DND/consent) · **B5** composeFor tokens · **B6** createCampaign/send (Interaction per recipient, snapshot, status) · **B7** CampaignService tests · **B8** SmsService.sendBulkNative extension (backward-compat) · **B9** GreetingQueue extension · **B10** engine tests + baseline reconfirm.
Phase C (UI): **C1** OccasionManager+Settings · **C2** route+nav · **C3** CampaignList · **C4** builder steps 1-3+preview · **C5** builder targeting+counts · **C6** send hand-off+status · **C7** dashboard nudge.
Phase D (notif): **D1** add plugin+register · **D2** NotificationService (desktop no-op) · **D3** Settings toggle+schedule.
Phase E (ship): **E1** test sweep ≥125 · **E2** version bump+build+sync · **E3** docs · **E4** adversarial review + /security-review · **E5** APK + device checklist.

Report at each phase boundary (A/B/C/D/E). Each task obeys the universal pre/post checklists above.

## Progress log (append-only)
- 2026-06-02 — Plan authored & approved. Scope: custom occasions + per-occasion bilingual templates + tagline `{tagline}`. Awaiting: (a) Foundation Day date, (b) go to start T10.1. No feature code yet; v3.0.7 (Iter 9.5) still staged-uncommitted on top of `978547f`.
- 2026-06-02 — "go" received (owner will commit 9.5 + Iter 10 together at the end). Foundation Day to be added by owner via the occasion manager (not seeded). Granular A1–E5 breakdown + universal checklists folded in. Starting 0.1 → Phase A.
- 2026-06-02 — **Phase E COMPLETE → Iter 10 CODE-COMPLETE (v3.1.0 / vc10):** E2 version bump (package.json/constants/variables.gradle). E4 adversarial review — 3 parallel agents (correctness, security/PII, regression); findings fixed: (MED) GreetingQueue `current.phone` escaped (stored-XSS); (MED) `finalStatus` now treats deliberate WhatsApp skips as a decision not failure; (LOW) composeFor clears Devanagari placeholders + collapses blank lines; (LOW) notification time clamped; (LOW) Settings machine table escaped. Reviewers confirmed clean: consent/DND non-bypassable, no PII to logs, sync export/import unaffected by new device-local keys, migration idempotent on all paths, reminder SMS/WhatsApp flows unchanged, no double-logging. E1 final gate: `vite build` 378.82 kB clean, **146/146** tests, cap sync clean. E3 docs updated (PROJECT_PLAN §2/§3, VISION §6). E5: device pass is owner's step — see Manual test checklist above. **Remaining before "production-ready": real-device verification + owner commit (9.5 + 10 together).** Known limits documented (channel SMS-or-WhatsApp per campaign; WhatsApp text-only; occasions/campaigns device-local; WhatsApp-campaign WebView-kill can leave 'sending').
- 2026-06-02 — **Phase D COMPLETE (web-verified; native deferred to device):** D1 installed `@capacitor/local-notifications@8.2.0` (peer core>=8 ✓), `cap sync` registered it for Android (official plugin auto-registers — no MainActivity change). D2 `NotificationService` (runtime-plugin access like SmsService; `isAvailable`/`requestPermission`/`sync`/`cancelAll`/`_buildSchedule` — daily reminder digest + occasion nudge at `notificationDigestTime`, cancels only its own IDs, **NO-OPs off-device**). D3 Settings 🔔 Notifications card (toggle + time + Save&apply → reschedule) + launch-time `NotificationService.sync()` in main.js. `tests/notification-service.test.js` (off-device guard). Gate: `vite build` clean (378.66 kB), **144/144** tests (+4), cap sync clean. ⚠️ Native scheduling NOT verifiable in-session (needs Java-21 APK on device) → Phase E device checklist. Next: Phase E (ship).
- 2026-06-02 — **Phase C COMPLETE & verified:** C1 `OccasionManager` (list/add/edit/delete + bilingual template editor) mounted in Settings; tagline + default-campaign-language settings added to Preferences (saved). C2 route `#/campaigns` + `/campaigns/new?occasionId=` + nav tab. C3 `CampaignList` (upcoming-occasion suggestion cards + audience count + past-campaign history w/ status badges). C4/C5/C6 `CampaignBuilder` (occasion/custom-date → type/language → editable template w/ LIVE preview → SMS|WhatsApp channel w/ size-based recommendation → targeting city/category/tag + consent w/ live recipient + excluded counts → confirm → hand-off to SmsBatchQueue/GreetingQueue → recordResult). C7 dashboard occasion nudge → builder. Added **happy-dom** dev-dep + `tests/campaign-ui.test.js` render smoke (executes all 3 components: preview substitutes name+tagline, no raw tokens, Devanagari renders, live count). Gate: `vite build` clean (374.54 kB), **140/140** tests (+4), cap sync clean. NOTE: DOM render verified in-session; visual/layout + actual send still need device verification (Phase E checklist). Next: Phase D (notifications).
- 2026-06-02 — **Phase B COMPLETE & verified:** B1/B2 `OccasionService` (nextOccurrence w/ leap-clamp + year-rollover, upcomingWithin sorted, birthdaysWithin reuses ReminderService, validated CRUD); B4/B5/B6 `CampaignService` (buildRecipients w/ always-exclude-DND + optional consent + no-phone/deleted counts; composeFor token substitution incl `{tagline}` + leftover-placeholder clearing; prepareItems precomposes per-recipient message + omits reminderId so engines skip reminder-marking; createCampaign/markSending/recordResult/finalStatus lifecycle — engines own interaction logging, no double-count); B8/B9 backward-compatible engine extensions (`SmsService._composeMessage`/`GreetingQueue._composeMessage` honor `item.message`; logs use `item.notes`; missing-eventType badge guard); B3/B7/B10 tests. Gate: `vite build` clean (340.83 kB), **136/136** tests (+22), cap sync clean, existing SMS/sync tests still green (no regression). Next: Phase C (UI).
- 2026-06-02 — **0.1 ✓** baseline green (build clean, 111/111, cap sync clean). **Phase A COMPLETE & verified:** A1/A2 constants (5 seed occasions + bilingual templates + `{tagline}`/`{occasion}` tokens + new settings); A3 `Occasion.js` (model + validate: leap-29 ok, Feb-30/month-13/no-name rejected); A4 `Campaign.js`; A5 state CRUD (`get/add/update/deleteOccasion`, `get/add/updateCampaign`, `_saveAndNotify`); A6 `storage.js` idempotent `ensureForwardFields` wired into loadState same-major path + migrateState (seeds occasions/campaigns/settings onto live v3.0.7 w/o data loss); A7 migration tests. Gate: `vite build` clean (340.67 kB), **114/114** tests (+3), models node-verified incl. Devanagari. No data-flow/PII surface this phase; sync tests still green (no regression from new state keys). Next: Phase B (services).
