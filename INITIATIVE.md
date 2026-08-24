# INITIATIVE — Dnyani Mitr, rebuilt

> **This is the source of truth for what we are building and why.**
> Opened 2026-08-24. Maintained until delivery, then archived — not abandoned mid-flight.
>
> **Authority order:** live source code → this document → everything else.
> If this document and the code disagree, the code is right and this document is a defect
> to fix in the same change. Never route around it silently.
>
> **This is the only planning document.** `PROJECT_PLAN.md`, `VERSION_3_VISION.md`,
> `ITERATION_2/10/11_PLAN.md`, `RESUME.md`, `docs/ITERATION_11_REVIEW.html`,
> `docs/testing_guide.md` and `docs/laptop_only_deployment_guide.md` were **deleted 2026-08-24**
> so that a restart or resume always lands on one baseline. Nothing is lost — they are in git:
> `git show 9af1a1f:ngo-visitor-manager/<file>`. **Do not recreate them.**
>
> What still exists alongside this file, and why: `README.md` (repo entry point) ·
> `KEYS.md` (activation keys — operational, irreplaceable) · `docs/LOCAL_TEST_v3.2.0.md`
> (Run B, which gates Phase 0) · `docs/design-preview-v3.3.html` (design direction, D-11).

---

## 0 · How to use this document

Four sections carry the weight. Read them in this order and you have the whole initiative:

1. **§3 Scope — the six jobs.** If a proposed thing serves none of them, it does not ship.
2. **§4 Principles.** The decision rules. When two options both look reasonable, these break the tie.
3. **§5 Decisions.** Every settled question, with its reasoning and date. **Point at a decision
   ID rather than re-arguing it.** Re-opening one is allowed; doing it silently is not.
4. **§8 Delivery.** Phases and their gates.

**Adding to this document:** new decisions append to §5 with the next ID. New facts learned
append to §14. Nothing in §5 or §14 is edited in place except to mark a status change — the
history of what we believed and when is the point.

**Open questions live in §11.** A question that gets answered becomes a decision in §5 and is
struck from §11. A question nobody has answered must never be silently decided by whoever
happens to be implementing.

---

## 1 · What this is

> **A register of the people who help this NGO, that remembers them well enough
> to reach back at the right moment.**

Not a CRM. Not a visitor log. Not a donation system.

The failure this exists to prevent: **someone brings a meal, is never thanked, is never
remembered, and drifts away.** Every feature either serves that or is cut.

**Context that shapes everything:** three NGOs in remote Maharashtra, running on cheap Android
phones and a few laptops, with unreliable network. They pass data by WhatsApp. Volunteers are
mostly 40–60, not technical, will never be trained, and are mid-task when they use the app.

---

## 2 · Who uses it

| | Who | Where | Needs |
|---|---|---|---|
| **P1** | **Intake** — answers the phone, greets at the gate | Cheap Android, mid-conversation | J1, in seconds |
| **P2** | **Coordinator** — runs the office, does outreach, reports to trustees | Laptop or phone, patient | J2, J3, J4 |
| **P3** | **Maintainer** — us, remote, supporting three NGOs | Laptop | To know it is working without asking |

**P3 has never had a single artifact built for it.** That is why we spent months guessing whether
campaigns were used. `scripts/analyze-backup.js` is its first tool and stays first-class.

---

## 3 · Scope — the six jobs

| | Job | Serving |
|---|---|---|
| **J1** | Someone is coming, or someone came — record it in seconds | P1 |
| **J2** | Who should we reach out to today? A short, correct list | P2 |
| **J3** | Reach out — compose, send, and **remember that we sent** | P2 |
| **J4** | Prove the work — numbers for trustees and donors | P2 |
| **J5** | Never lose the register | P1, P2, P3 |
| **J6** | Keep three NGOs in step, with no server | P2, P3 |

**This list is the scope boundary.** Anything outside it is out, regardless of how good an idea
it is. Adding a seventh job requires a decision entry in §5.

### 3.1 · Use cases

Each is tagged with the job it serves. **⚠ marks what must never happen** — these are the
failure modes that make the app worse than a paper register, and most of them are principle
violations we have already shipped once.

---

**UC-01 · A supporter phones to say they are coming** — J1 · *the primary flow*

> *"माझं नाव सुनीता पाटील, मी २० तारखेला मुलीच्या वाढदिवसाला येणार आहे."*

1. Intake opens the capture sheet. **Phone field first.**
2. Types the number → live lookup on each keystroke.
   - **Known** → name auto-fills, "4 previous interactions" shown.
   - **Unknown** → "New supporter — they will be added to your list."
3. Taps occasion chip *Birthday*, relation *CHILD*, whose *मुलगी*, and the **occasion's own date
   (18 Aug 2015)** — deliberately separate from the visit date (20 Aug 2026).
4. Save.

**Writes:** a `ScheduledItem` (`direction: inbound`, `status: pending`). If new, also a `Visitor`
with a SELF `Contact`, plus a **CHILD `Contact` carrying that birthday as an event**.

**Why that last part matters:** the child's birthday now enters the reminder engine. On 18 Aug
*every following year*, unprompted, the NGO is reminded. One phone call becomes a permanent
relationship. This is the single highest-value flow in the product.

⚠ Never store a placeholder number. A hard-required phone makes staff type `0000000000`, and
under last-10-digit dedup that merges unrelated supporters and propagates the merge through sync.

---

**UC-02 · Someone arrives unannounced** — J1

Same sheet, date defaults to today, marked as already happened. Often the caller gives a number
and nothing else.

**Writes:** `Visitor` (may be nameless — displays as its number, D-07) + `Interaction`.

⚠ **The form must save with a phone and nothing else.** Today it refuses (name is required,
phone is not) — exactly backwards, and the reason someone in a hurry records nothing at all.

---

**UC-03 · Marking a planned visit done** — J1

Tap **Done** on an inbound item → the app asks **"Did they come?"**

- **Yes** + linked visitor → writes an `Interaction`, `outcome: happened`.
- **No** → `outcome: no_show`, **no Interaction written**.

⚠ Never auto-complete. A silent completion sends a warm thank-you for a visit that never
happened, which is worse than sending nothing (PR-3).

---

**UC-04 · Recording something from last week** — J1

Day pane → *"Log what happened that day"* → same sheet, `backfill: true`.

**Writes:** `Interaction` with `interactionDate` set to **that day**, not today.

⚠ Stamping "now" would destroy the history that UC-06 depends on.

---

**UC-05 · The morning check** — J2

Open the app → **Today**: counts, the day's list ordered *coming to us → needs catching up →
we are going → on this day*.

**Reads only.** Reminders are **derived, never stored** (DF-6).

⚠ No accusations. *"Last visit — in July"*, not *"Overdue — 41 days"* (D-10).

---

**UC-06 · A year ago today** — J2 + J3 · *NGO-requested*

The day pane also lists visits from this date in previous years, with a one-tap message.

**Reads** `Interaction.interactionDate` matched on month+day across years — data we already hold
and currently discard after its day passes.

⚠ Never render the section empty (fewer than one visit per calendar date is normal — widen to
±3 days and say so). ⚠ Never offer *"we miss you"* to someone seen within ~6 months. ⚠ Never
say *"thank you for the gift"* until contributions are actually recorded.

---

**UC-07 · Someone we have lost touch with** — J2

Surfaced from last-interaction date. Do-Not-Contact excluded at both list build and click time.

---

**UC-08 · Sending a greeting** — J3

Pick the person → template fills `{name}` `{org}` `{tagline}` → opens WhatsApp or SMS.

**Writes:** `Interaction` (the send) + `thankedAt`.

⚠ `thankedAt` records **intent, not delivery** — we hand off and never learn the outcome. The UI
must not claim more than that (PR-3).

---

**UC-09 · Thanking after a visit** — J3

Same as UC-08, triggered from the visit rather than the calendar. Drives the *"N people to
thank"* count.

⚠ Bound the pending count by age, or it becomes another accusation.

---

**UC-10 · The monthly trustee report** — J4

Coordinator, laptop. Date range → filters → counts → CSV.

⚠ CSV needs a UTF-8 BOM or every Marathi name opens as mojibake in Excel — which is exactly
where a trustee opens it.

---

**UC-11 · Backing up before an upgrade** — J5 · *the one behaviour we ask for*

Sync → *Backup as text* → gzip → base64 → CRC32 → chunked → copied → sent to themselves on
WhatsApp. A 300-visitor register is **~0.46 MB gzipped ≈ 2 messages**.

⚠ Never report a backup that was not written. `saveFile()` reported success on three broken
Android paths, which means **phone "file backups" taken before v3.2.0 do not exist and the NGOs
do not know**.

---

**UC-12 · Restoring after a lost phone** — J5

Paste the message → chunks reassembled → CRC verified → decompressed → restored.

⚠ Absent ≠ empty. A collection missing from the package must be left alone, not written as `[]`
— `ensureForwardFields` reads `[]` as "the user deleted these".

---

**UC-13 · The office plans, the field phone executes** — J6

Coordinator makes plans → *Send plans* (one message, not five) → volunteer imports.

**Merge:** sending is assigning · plans carry a denormalised `visitorName` and visitor stubs ·
cancellations travel as 30-day tombstones · `done` is terminal on the receiving device ·
re-import is idempotent.

---

### 3.2 · Data flows

**DF-1 · The write path.** `Component → Service → StateManager → StorageManager → localStorage`,
with `EventBus` notifying subscribers. Components must stop reading `StateManager` directly and
rendering model fields — that is D-06, and it is why the visitor form shows fifteen of them.

**DF-2 · Identity resolution.** `phone → normalizePhone() (strip non-digits, last 10) → scan
visitors → match SELF contact phones`.
*Known limits:* only SELF phones are searched, so a supporter reachable on a family member's
number will not match. Devanagari digits currently yield `null` (A2.5 fixes this).

**DF-3 · Occasion → reminder, the flow that compounds.**
`occasion captured on a call → Contact created with relationType + event → ReminderService
derives it every year → surfaces on the day → greeting sent → Interaction logged`.
One call in 2026 produces a reminder in 2027, 2028, 2029.

**DF-4 · Scheduled item → interaction.** `ScheduledItem(pending) → Done → "Did they come?" →
happened + visitorId ⇒ InteractionService.log()`. **Both conditions required.** A no-show writes
nothing; an unlinked item writes nothing.

**DF-5 · Sync merge.** `decode → validate → auto-backup to NGOApp_v2_PreSyncBackup → index local
by id and by phone → Tier 1 match on visitor.id → Tier 2 match on normalized SELF phone → remap
incoming interaction visitorIds through the merge table → last-write-wins on updatedAt`.
A phone match with a **different name flags a duplicate rather than merging** — the precedent
D-18 follows.

**DF-6 · Reminders are derived, never stored.** Computed from contact events on every read. This
is why a birthday captured once keeps working forever, and why there is no reminder table to
migrate or corrupt.

### 3.3 · Business scenarios these exist to serve

**The compounding relationship.** A supporter visits once for a child's birthday. Handled well,
that is a reminder every year, a greeting every year, and a supporter for a decade. Handled
badly it is one row nobody reads. The whole product is the difference between those two.

**The phone that breaks.** Field volunteers use cheap handsets. When one dies, the register is
gone unless a text backup exists. Hence PR-5: one behaviour, and this is it.

**The volunteer who leaves.** Knowledge lives in the register or it leaves with them. Which is
why capture must survive a hurried, half-informed entry (PR-2).

**The trustee meeting.** Once a quarter the NGO must show what happened. If that number takes an
afternoon to assemble, the app has not done its job.

**The festival that moves.** Diwali falls on a different Gregorian date every year. The app
**refuses to guess** and shows "needs a date" instead — a greeting to hundreds of supporters on
the wrong day is worse than one not sent at all.

---

## 4 · Principles

Derived 2026-08-24 from reviewing how these NGOs actually work, after they told us a
five-minute ChatGPT-built app was easier to use than ours. They were right about the thing they
measured.

**PR-1 · The phone number is the only thing we ask them to get right.**
It has no spelling variants, it is typed on a numeric keypad, and it is the identity key.
Everything else tolerates mess. Never validate a name.

**PR-2 · Every screen must be useful at the laziest possible input.**
A visit recorded as a phone number and nothing else is a **complete record**, not a degraded
one. No screen may block, scold, or show a half-empty state because someone was in a hurry.

**PR-3 · Never be silently wrong — rank that above being clever.**
Every message describes what the code *verified*, never what it hoped. No auto-merge, no
guessed festival dates, no "backup saved" unless bytes were written, no thank-you for a visit
that may not have happened. Our real defects have all been this class.

**PR-4 · Teach in place, or not at all.**
One line of explanation exactly where the confusion happens. Where a physical artifact is
needed, make it physical — a laminated card by the office phone, not a manual.

**PR-5 · Change one behaviour at a time.**
Currently exactly one: **take a text backup before you upgrade.** Nothing is added until that
one is habitual. Ten asks is zero asks.

**PR-6 · Learn from what they already send us.**
The backup carries, in aggregate, everything we need to know about what is used. No telemetry,
no network, no new burden — and **we tell them we do it** (see D-12).

---

## 5 · Decisions

Status: **SETTLED** · **PROVISIONAL** (holds until evidence arrives) · **REOPENED**

| ID | Date | Decision | Why | Status |
|---|---|---|---|---|
| **D-01** | 2026-08-24 | **Stay offline-first.** No hosted database, no per-NGO backend, no accounts. | Network is the original constraint and has not changed. Free tiers suspend or die; auth is this user base's main failure point; N deployments means N things to operate; and PII leaving the device changes our posture under the DPDP Act. | SETTLED |
| **D-02** | 2026-08-24 | **No data archiving, no storage tiering.** | Measured: 300 visitors + 3,600 interactions = **0.46 MB gzipped**. Every free tier offers 500 MB+. Storage is a non-constraint by two orders of magnitude, and an archive mechanism is a way to lose history for no benefit. | SETTLED |
| **D-03** | 2026-08-24 | **Rebuild the view layer and shell. Keep the services.** | Every review finding landed on the surface. `SyncService` / `ReminderService` / `TextSyncService` / `CalendarService` encode UTC-vs-IST local-midnight semantics, annual date resolution, two-tier phone dedup and absent-vs-empty restore — each learned by fixing a real bug, each pinned by tests. Rewriting them re-earns those bugs. | SETTLED |
| **D-04** | 2026-08-24 | **Stay vanilla JS + Vite singlefile + Capacitor.** | Native loses the laptop users and the `file://` path. PWA-only install is unreliable on MIUI/ColorOS with no dependable file intents. A framework adds a dependency that must survive years unattended — the build already broke once from a vite bump. | SETTLED |
| **D-05** | 2026-08-24 | **Impose a component kit + design tokens** (Sheet, Chips, Tile, Row, Section, Empty — ~200 lines). | The problem was never the absence of a framework, it was the absence of a convention: 7,700 lines of components with ad-hoc per-component CSS. This buys most of what a framework gives at zero dependency risk. | SETTLED |
| **D-06** | 2026-08-24 | **Screens are built from jobs, not entities.** | Components currently read `StateManager` and render model fields, which is why the visitor form shows 15 of them. The model stops leaking onto the screen. | SETTLED |
| **D-07** | 2026-08-24 | **Phone becomes required; name becomes optional.** A nameless visitor displays as their number. | Verified: today `validateContact` blocks phone-only and permits name-only — exactly backwards. The app mandates the field with spelling variance and optional-ises the identity key. | SETTLED |
| **D-08** | 2026-08-24 | **Tap-first input.** Chips replace `<select>` wherever the option set is short and stable. | Measured: 26 selects, 9 checkboxes, 32 text inputs across our components — against 22 checkboxes in one form of the app they preferred. A chip is one tap; a select is tap → read → scroll → tap in an OEM picker. | SETTLED |
| **D-09** | 2026-08-24 | **Bottom sheets, not centred dialogs.** | Theirs rises from the thumb like every Android app these volunteers already use. Ours floats in the middle of the screen — a desktop dialog on a phone. | SETTLED |
| **D-10** | 2026-08-24 | **A host's vocabulary, not an administrator's.** No "Machine Role", "Overdue", "Never contacted", "Data Quality". | *Overdue* and *Never contacted* are accusations. The app currently opens each morning by listing what the volunteer failed to do. Same query, different sentence. | SETTLED |
| **D-11** | 2026-08-24 | **Ledger-register design language** — aged paper, ledger-blue ruling, binding red, marigold for occasions. Section labels hang from a rule. | Grounded in the object this replaces — the bound paper visitor register — and in the शिरोरेखा of Devanagari. Our current palette is Tailwind's defaults verbatim. See `docs/design-preview-v3.3.html`. | PROVISIONAL — awaiting NGO reaction |
| **D-12** | 2026-08-24 | **Read the backups they already send, and tell them we do.** | Turns roadmap decisions from guesses into evidence with zero code on the device. Disclosure is what makes it a service rather than a betrayal. `scripts/analyze-backup.js` never prints a name or a number and has a guard that refuses to print if one slips through. | SETTLED |
| **D-13** | 2026-08-24 | **Ship under the same `org.sewasankalp.ngomitr` and the same signing key.** | A new appId or key forces every device to uninstall. Data is now recoverable (D-14), but a forced uninstall across three remote NGOs is still a support event we get for free by not causing it. | SETTLED |
| **D-14** | 2026-08-24 | **Target zero re-entry; treat re-entry as the safety net.** | Owner confirms the keystore is backed up and re-entry is acceptable in the worst case. But we control both formats, so an importer is ~100 lines. Making volunteers retype two years of work reads as the app having failed them. | SETTLED |
| **D-15** | 2026-08-24 | **Definition of done replaces "tests pass"** — see §9. | The `styles-exist` guard exists because a render test passed on a button that did nothing. Green tests are the entry fee, not the finish line. | SETTLED |
| **D-16** | 2026-08-24 | **Campaigns / Occasions / GreetingQueue / SmsBatchQueue: fate decided by evidence.** | ~1,000 lines serving J3 in bulk, built in Iteration 10, never validated. The analyzer answers this in one afternoon. Deleting on suspicion is worse than keeping on evidence. | PROVISIONAL — gate at Phase 0 |
| **D-17** | 2026-08-24 | **Devanagari data-layer hardening lands before any Marathi UI.** | The moment the UI speaks Marathi, people type Marathi. Verified today: `normalizePhone('९८२२०१२३४५') → null`; nukta forms don't match without NFC; `namesSimilar('सुनीता','सुनिता') → false`; `localeCompare` has no locale; CSV has no BOM. Shipping the UI first manufactures bad data. | SETTLED |
| **D-18** | 2026-08-24 | **Fuzzy name matching is a *suggestion*, never an auto-merge.** | A fold key that tolerates IME spelling variance is deliberately aggressive (collapses श/ष/स and aspirates) and will occasionally match different people. Follows the existing rule: a phone match with different names flags a duplicate rather than merging it. | SETTLED |
| **D-19** | 2026-08-24 | **Work continues on a branch off `iter-11-day-release`, not from `main`.** | Iteration 11's contribution is overwhelmingly *service layer* and *defect fixes* — `CalendarService`, the backup/restore repairs, `FileService`, `followUpCompletedAt` — all of which D-03 keeps. Only its view layer is being replaced, and that was being replaced anyway. Discarding it would throw away work we have already decided to keep. Run B still matters, because it verifies migration against real data and migration is service layer. | SETTLED |
| **D-20** | 2026-08-24 | **D-07 refined: the SELF contact needs a phone *or* a name — never neither.** | A hard phone requirement would lose the real case of a caller who rings off before giving a number, and UC-01 already warns that a hard-required field makes staff type `0000000000`, which under last-ten-digit dedup merges unrelated supporters. Requiring *something* still prevents an anonymous empty record that can never be found, thanked or deduplicated. | SETTLED |
| **D-21** | 2026-08-24 | **Lookup searches every contact's phone; sync identity still matches on the SELF contact's first number only.** | Answers P1.7 / the DF-2 gap. A supporter phoning from their spouse's number appeared as a stranger, and intake offered to create a duplicate mid-call. Widening *lookup* helps a human find someone; widening *merge* would fuse two households sharing a landline. Different jobs, different rules — the same principle as D-18. | SETTLED |

---

## 6 · What dies

| Thing | Why |
|---|---|
| **Data Quality screen** | A maintainer's concern wearing a user's clothing. Serves no job. |
| **My Day *or* Calendar** | Two screens answering one question. Merged into **Today**. |
| **Root / Satellite in onboarding** | Our architecture on their first screen, asked before any value is delivered, of someone with no basis to answer. Silent satellite default; promotion in Settings. |
| **Eight nav destinations** | Reduced to five. |
| **EngagementScore / ConsentGiven CSV columns** | Analyst artifacts, not trustee numbers. |
| **Master-key activation gate** | See Q-01 — justified or removed, not left by default. |
| **Campaigns subsystem** | Conditional on D-16. |

---

## 7 · Architecture

**Unchanged:** vanilla ES modules · Vite + `vite-plugin-singlefile` → one `index.html` that runs
from `file://` · Capacitor 8 for Android · LocalStorage · WhatsApp text sync (gzip → base64 →
CRC32 → chunks) · vitest + happy-dom.

**Kept wholesale:** `SyncService`, `ReminderService`, `TextSyncService`, `CalendarService`,
`InteractionService`, `VisitorService`, and their tests (323 passing at time of writing).

**Rebuilt:** every component, the shell, all CSS, all user-facing strings.

**Model changes** — both additive, both need `migrateState()` handling and a null-safe default:
- `Interaction.contribution` — what they brought (chips: meal / donation / books / clothes /
  educational / grocery) plus a free-text item line.
- `Interaction.thankedAt` — J3's memory. Optimistic by nature: we hand off to WhatsApp and never
  learn delivery, so this records *intent*, and the UI must not claim more (PR-3).

**Data-layer hardening (D-17), in priority order:**
1. Fold key for search, dedup ranking and merge suggestions — derived at read time, **no stored
   field, no migration**. Prototype scores 19/20 on realistic Marathi variants.
2. `.normalize('NFC')` on every write and every query.
3. `localeCompare(a, b, 'mr-IN')` wherever names sort.
4. UTF-8 BOM on CSV.
5. Devanagari/Arabic-Indic digit folding in `normalizePhone` — low probability (transliteration
   keyboards emit ASCII digits), cheap insurance.

---

## 8 · Delivery

**Legend — who executes:** `AUTO` unattended · `OWNER` you · `NGO` needs a volunteer or a device.
A phase gate is a real-world event, never a green test suite (D-15).

Task IDs are stable. Tick them here; a restarted session resumes from the ticks plus §14.

---

### Phase 0 — ground truth · days · **gates everything after it**

| | Task | Verify / gate | Who |
|---|---|---|---|
| ✅ **P0.1** | Commit the baseline — INITIATIVE.md, analyzer, design preview, nine doc deletions, repointed source refs | clean `git status`; 323 tests | AUTO |
| **P0.2** | Run B — upgrade rehearsal against **real NGO data** (`docs/LOCAL_TEST_v3.2.0.md`) | visitor count, Marathi renders, history intact, no console errors | OWNER |
| **P0.3** | Collect one current backup per NGO, with the D-12 disclosure said first | 3 files in hand | OWNER |
| **P0.4** | Run `scripts/analyze-backup.js` on all three; append findings to §14 | report produced; counts recorded | AUTO |
| **P0.5** | **Resolve D-16** — campaigns live or die, on P0.4 evidence | decision status changed in §5 | OWNER |
| **P0.6** | Send `docs/design-preview-v3.3.html` to the three NGOs | Q-02 and Q-03 answered; D-11 confirmed or revised | NGO |
| **P0.7** | **Answer Q-01** — activation gate justified or removed | becomes a decision in §5 | OWNER |
| **P0.8** | Check the Marathi pack is enabled in Gboard on pilot devices (Q-04) | yes/no per device | OWNER |

**Gate:** D-16 resolved · D-11 confirmed or revised · Q-01…Q-04 answered.
*P1.1–P1.7 may start before this gate — they are data-layer only and depend on none of it.*

---

### Phase 1 — the spine · 1–2 weeks

**Batch A — data foundation** *(no UI change, no visual risk, unblocked today)*

| | Task | Verify | Who |
|---|---|---|---|
| ✅ **P1.1** | `src/utils/devanagari.js` — fold key (D-18): NFC → irregular conjuncts (ज्ञ/क्ष/त्र/श्र) → schwa rule → matra/sibilant/aspirate collapse → Latin equivalences | new test file, ≥20 realistic pairs **including must-NOT-match** cases | AUTO |
| ✅ **P1.2** | NFC normalisation on every name write and every search query | test: precomposed क़ (U+0958) matches decomposed क+़ | AUTO |
| ✅ **P1.3** | `localeCompare(a, b, 'mr-IN')` at all three sort sites | test pinning ज्ञ last, per Marathi वर्णमाला | AUTO |
| ✅ **P1.4** | UTF-8 BOM on CSV export (`helpers.js`) | test asserts blob starts `\ufeff` | AUTO |
| ✅ **P1.5** | Devanagari + Arabic-Indic digit folding in `normalizePhone`; widen `PHONE_PATTERN` | `normalizePhone('९८२२०१२३४५') === '9822012345'` | AUTO |
| ✅ **P1.6** | **D-07** — phone required, name optional; nameless visitor renders as its number | validator tests inverted | AUTO |
| ✅ **P1.7** | **DF-2 gap** — decide and implement whether lookup searches family-member phones, not only SELF | new decision in §5; test either way | AUTO |

**Batch B — the component kit** *(foundation; still no screen changes)*

| | Task | Verify | Who |
|---|---|---|---|
| **P1.8** | Design tokens (D-11) into `variables.css`, replacing the Tailwind defaults. Values provisional — one file changes them after Q-03 | build clean; no hardcoded hex left in `main.css` | AUTO |
| **P1.9** | Component kit (D-05): `Sheet` (bottom), `Chips`, `Tile`, `Row`, `Section`, `Empty` | render test per component | AUTO |
| **P1.10** | Extend `tests/styles-exist.test.js` to every class the kit uses | missing-class list empty | AUTO |
| **P1.11** | **Visibility** assertions, not just render — position, z-index, off-screen checks | a deliberately unstyled component fails the suite | AUTO |

**Batch C — the first screen** *(owner review expected at the end)*

| | Task | Verify | Who |
|---|---|---|---|
| **P1.12** | Capture sheet rebuilt on the kit — phone-first, chips, bottom sheet, org name in header (**UC-01, UC-02**) | records a visit with phone only | AUTO |
| **P1.13** | Wire in; **remove the old form in the same commit** so no half-converted state ships | one capture path exists in the tree | AUTO |
| **P1.14** | Importer round-trip (D-14): export from current build → import into rebuild | analyzer counts match on both sides | AUTO |
| **P1.15** | Nameless-visitor audit — every list, detail, search, export, sync surface | no blank rows anywhere | AUTO |

**Batch D — close out**

| | Task | Verify | Who |
|---|---|---|---|
| **P1.16** | Update §13; append §14 lines for what was learned | doc matches reality | AUTO |
| **P1.17** | `vite build` → `cap sync android` → `assembleDebug` → `./scripts/verify-apk.sh` | prints **Signature matches** | AUTO |
| **P1.18** | Write the device checklist for the capture sheet, replacing `LOCAL_TEST_v3.2.0.md` | checklist exists | AUTO |
| **P1.19** | Install on the pilot phone; a volunteer records a real visit **unaided** | they succeed without being told how | NGO |

**Gate:** P1.19 passes. If they need to be told how, the screen is wrong — fix it before Phase 2.

---

### Phase 2 — the day · 1–2 weeks

| | Task | Verify | Who |
|---|---|---|---|
| **P2.1** | Shell: **five** destinations, sticky header, NGO identity in it | nav fits a 360px screen without scrolling | AUTO |
| **P2.2** | **Today** — stat row answering *"how is today?"* (**UC-05**) | counts correct against fixture | AUTO |
| **P2.3** | Today — four large action tiles | targets ≥44px | AUTO |
| **P2.4** | Today — calendar inline **plus** the day's list, one scroll. Merges My Day and Calendar (see §6) | one screen, no navigation to see today | AUTO |
| **P2.5** | Day pane order: coming to us → needs catching up → we are going → on this day | order test | AUTO |
| **P2.6** | **"A year ago today"** — month+day matching for interactions in `CalendarService` (**UC-06**) | test across year boundaries and leap days | AUTO |
| **P2.7** | UC-06's three guards: never render empty (widen ±3 days) · no *"we miss you"* under ~6 months · no gift claim before contributions exist | one test per guard | AUTO |
| **P2.8** | Reminders screen rebuilt, host vocabulary (**UC-07**, D-10) | no accusatory string remains | AUTO |
| **P2.9** | **Vocabulary sweep** — every user-facing string; delete "Machine Role", "Overdue", "Never contacted", "Data Quality" | grep finds none | AUTO |
| **P2.10** | J3 single-message send with mark-as-sent (**UC-08, UC-09**) | Interaction + `thankedAt` written | AUTO |
| **P2.11** | `Interaction.thankedAt` — model field, `migrateState()` handling, null-safe default | migration test from v3.2.0 fixture | AUTO |
| **P2.12** | Pending-thanks count, **age-bounded** so it cannot become an accusation | test: old items drop off | AUTO |
| **P2.13** | `Interaction.contribution` — chips (meal/donation/books/clothes/educational/grocery) + free-text item line, on the capture sheet | migration test; chips optional | AUTO |
| **P2.14** | First run asks nothing about machines — silent satellite; promotion moves to Settings | fresh install reaches Today with no architecture question | AUTO |
| **P2.15** | Act on Q-01: keep the activation gate with a stated reason, or remove it and `KEYS.md` | matches the §5 decision | AUTO |
| **P2.16** | Never-blank defaults on every screen (dates pre-filled, filters pre-set) | no screen opens empty-and-blocking | AUTO |
| **P2.17** | Delete the Data Quality screen and its routes/tests | gone; nav still five | AUTO |
| **P2.18** | Build, sign, verify, ship to pilot; **48-hour soak** | analyzer shows records were created during the soak | NGO |

**Gate:** 48 hours of real use, and the analyzer proves records were actually created — not just that the app was installed.

---

### Phase 3 — proof and safety · ~1 week

| | Task | Verify | Who |
|---|---|---|---|
| **P3.1** | Reports screen: date range, type filter, search (**UC-10**) | filters compose correctly | AUTO |
| **P3.2** | Live count tiles on Reports, pre-set to this month so it never opens empty | opens with data | AUTO |
| **P3.3** | CSV columns rewritten for trustees; drop `EngagementScore` / `ConsentGiven` (§6). Check Q-06 first | columns match what a trustee reads | AUTO |
| **P3.4** | CSV export verified **on an Android device**, not just in a test | file opens in Excel, Marathi intact | NGO |
| **P3.5** | Backup / restore UI rebuilt on the kit (**UC-11, UC-12**) | round-trip preserves all nine collections | AUTO |
| **P3.6** | Backup-age nudge derived from `syncLog` — the one behaviour we ask for (PR-5) | appears after N days, dismissible | AUTO |
| **P3.7** | Regression test: **absent ≠ empty** on restore | a package missing `occasions` leaves them untouched | AUTO |
| **P3.8** | Send plans / receive plans (**UC-13**, J6) | one message for a week of plans | AUTO |
| **P3.9** | Plan merge rules under test: assignment, visitor stubs, 30-day tombstones, terminal `done`, idempotent re-import | one test per rule | AUTO |
| **P3.10** | A coordinator produces a trustee report **unaided** | they succeed without help | NGO |

**Gate:** P3.10 passes, and a backup taken on one device restores intact on another.

---

### Phase 4 — bulk messaging · conditional on D-16

*Only one of these branches executes.*

| | Task | Verify | Who |
|---|---|---|---|
| **P4.A1** | **If D-16 = dead:** remove Campaigns, Occasions, GreetingQueue, SmsBatchQueue — components, services, routes, tests, nav, and their state collections | build shrinks; tests green; migration still reads old data without crashing | AUTO |
| **P4.A2** | If dead: confirm `occasions` data is retained in storage even with the UI gone, so nothing is destroyed by an upgrade | restore of an old backup still round-trips | AUTO |
| **P4.B1** | **If D-16 = alive:** rebuild the campaign flow on the kit, shaped by what P0.4 showed was actually used | a campaign can be built and previewed | AUTO |
| **P4.B2** | If alive: occasion date entry with the visible **never-guess** state for movable festivals | "needs a date" shown, no lunar guessing | AUTO |
| **P4.B3** | If alive: owner sources movable festival dates from a verified almanac | dates entered and confirmed | OWNER |

---

### Phase 5 — rollout

| | Task | Verify | Who |
|---|---|---|---|
| **P5.1** | **Tell all three NGOs their phone "file backups" from before v3.2.0 do not exist**, and have each re-take one as text | 3 fresh text backups in hand | OWNER |
| **P5.2** | The laminated card — one card, three lines, for beside the office phone (PR-4) | printed and delivered | OWNER |
| **P5.3** | Volunteer instructions — short, in their language, for the two flows they actually use | written | AUTO |
| **P5.4** | Laptop deployment note — replaces the guide deleted 2026-08-24; four machines, which browser (per Q-07) | written | AUTO |
| **P5.5** | Build the distributable APK on the maintainer's machine; `verify-apk.sh` | **Signature matches** | AUTO |
| **P5.6** | Pilot: one phone + one laptop, 48-hour soak, before anyone else | no data loss, no red console errors | NGO |
| **P5.7** | Roll out to the remaining two NGOs over WhatsApp | each confirms it opened and their data is intact | OWNER |
| **P5.8** | Two weeks after rollout: collect backups, run the analyzer, append to §14 | usage evidence recorded | AUTO |
| **P5.9** | Retain the previous APK as rollback; record where it lives | path recorded in §13 | OWNER |
| **P5.10** | Archive this document — mark it delivered, keep it in the repo | §14 closed with a delivery entry | AUTO |

**Gate:** all three NGOs on the new build, each having confirmed their register is intact.

---

### Task count and shape

| Phase | Tasks | AUTO | OWNER / NGO |
|---|---|---|---|
| 0 — ground truth | 8 | 2 | 6 |
| 1 — the spine | 19 | 18 | 1 |
| 2 — the day | 18 | 17 | 1 |
| 3 — proof and safety | 10 | 8 | 2 |
| 4 — bulk (one branch) | 2–3 | 2 | 0–1 |
| 5 — rollout | 10 | 4 | 6 |
| **Total** | **~68** | **~51** | **~17** |

**The critical path runs through the seventeen you own**, not the fifty-one I can execute. P0.2
(Run B) and P0.3 (three backups) block the most, and both are yours.

## 9 · Definition of done (D-15)

A change is done when **all** of these hold:

- [ ] Tests green (entry fee, not the finish line)
- [ ] `npx vite build` succeeds
- [ ] Built on the maintainer's machine and `./scripts/verify-apk.sh` prints **Signature matches**
- [ ] **Installs over the existing app** — no uninstall required
- [ ] A backup was taken before the upgrade
- [ ] **One NGO used it for 48 hours**
- [ ] The analyzer shows the feature actually produced records

---

## 10 · The deliverable is not only the app

- Signed APK (maintainer-built; **CI never distributes** — it signs with a throwaway key)
- The desktop `dist/index.html`, double-clickable
- **One laminated card** for beside the office phone (PR-4)
- The disclosure sentence about reading backups (D-12)
- `scripts/analyze-backup.js` and a cadence for running it
- The previous APK retained as rollback

---

## 11 · Open questions

Answer these into §5. **Never let them be decided silently by whoever implements.**

| ID | Question | Blocks |
|---|---|---|
| **Q-01** | What does the master-key activation gate protect? If licensing or provenance — keep and say so. If it exists because it seemed proper — delete it. | Phase 1 |
| **Q-02** | Marathi-first or English-first? Ask field volunteers and coordinators **separately** — they will not agree. | Phase 1 |
| **Q-03** | Does binding red (D-11) read correctly to them, or does it carry the wrong meaning? | Phase 1 |
| **Q-04** | Is the Marathi language pack actually enabled in Gboard on their phones? It is off by default, and transliteration is how they type. | Phase 1 |
| **Q-05** | P1.1 builds the fold key, so the mechanism will exist. What is still open: does **search** use it, and does it hold up on real Maharashtrian surnames? Needs ~50 real names per NGO to tune against — names only, no other fields. | Phase 2 |
| **Q-06** | Do any laptop users depend on the current CSV columns being what they are? | Phase 3 |
| **Q-07** | Which browser do the four laptop users actually open the app in? The deployment note has to standardise on one, and we have never asked. | Phase 5 |

---

## 12 · Risks

| Risk | Standing | Mitigation |
|---|---|---|
| **Wide visual diff passes tests and still looks broken on a Redmi** | Real. Our UI tests prove structure, not visibility — `styles-exist.test.js` exists because of exactly this. | Every phase gate is a device, not a suite. |
| **Second-system effect** — rebuilding with more ambition and less discipline | Real, and the classic way projects like this die. | D-03 keeps the services. §3 caps the scope at six jobs. |
| **Phone backups taken before v3.2.0 do not exist** | Confirmed defect (`saveFile()` reported success on three broken paths). The NGOs do not know. | Tell them plainly (PR-3). Not a release note. |
| **Movable festival dates are empty by design** | Correct behaviour, not a defect — a greeting on the wrong day is worse than none. | Owner sources dates from a verified almanac. |
| **Analysis outruns shipping** | Observed, this session: four reviews and a design page before one line of shipped code. | Phases in days; §9 forces a device. |

---

## 13 · Current state — 2026-08-24

| | |
|---|---|
| Version | v3.2.0 / versionCode 11 |
| Branch | `iter-11-day-release` — **2 commits ahead, not merged** |
| Commits | `e5c00f6` (Iteration 11, 54 files, +14,456/−5,386), `9af1a1f` (docs) |
| Tests | 323 passing, 22 files |
| Build | ~442 kB, ~153 kB gzip |
| Untracked | `docs/design-preview-v3.3.html`, `scripts/analyze-backup.js` |
| Keystore | **Backed up** (owner-confirmed 2026-08-24) |
| Blocking | `docs/LOCAL_TEST_v3.2.0.md` **Run B** unrun — decides Iteration 11's fate |

**Build gotchas that cost an hour each if forgotten:**
- `./gradlew` needs **Java 21**: `JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64`
- **Never `npm audit fix --force`** — it bumps vite to 8, outside `vite-plugin-singlefile@2.3.0`'s
  peer range, and `npm install` then fails for everyone. vite is pinned `^5.0.0` deliberately.

---

## 14 · Progress log

Append-only. Newest last. One line per event, with the date and what changed.

- **2026-08-24** — Initiative opened. Triggered by an NGO showing us a ChatGPT-built single-file
  app they found easier to use. Review concluded the gap was surface, not architecture: input
  modality (26 selects vs their 22 checkboxes), vocabulary, a centred dialog vs a bottom sheet,
  and Tailwind's default palette. Their app cannot do identity, recurring reminders or sync, and
  seven of its functions are silently overwritten by duplicate definitions.
- **2026-08-24** — Hosted-DB pivot proposed, examined, **dropped** (D-01). Storage measured;
  archiving dropped (D-02).
- **2026-08-24** — `docs/design-preview-v3.3.html` written: live side-by-side of today's app vs
  the proposal, the review evidence, and five decisions for the NGOs.
- **2026-08-24** — Devanagari audit: found `normalizePhone` returns `null` on Devanagari digits,
  no NFC anywhere, `localeCompare` without locale, no CSV BOM, and **no i18n infrastructure at
  all** — every UI string is hardcoded English. Also found the occasion system is *already*
  bilingual (`nameMr`, `templates.{greeting,invitation}.{en,mr}`).
- **2026-08-24** — Owner corrected a wrong assumption: volunteers use **transliteration
  keyboards** (Latin in, Devanagari out), not Devanagari layouts. Devanagari-digit risk
  downgraded; IME spelling variance upgraded to the primary issue. Fold-key prototype scores
  19/20 on realistic variants including ज्ञ read both the Marathi and Hindi way.
- **2026-08-24** — Principles PR-1…PR-6 derived, then reviewed against the code. Five held.
  **PR-1/PR-2 were contradicted:** phone-only is blocked, name-only saves (→ D-07).
- **2026-08-24** — `scripts/analyze-backup.js` written and tested (D-12). Two bugs found and
  fixed in it during testing: `Array.isArray` reported a full backup as partial, and a corrupted
  paste surfaced as a raw zlib error while continuing to report counts that would be wrong.
- **2026-08-24** — Owner confirmed keystore backed up and re-entry acceptable; constraints
  lifted. Initiative replanned end-to-end and this document opened as the source of truth.
