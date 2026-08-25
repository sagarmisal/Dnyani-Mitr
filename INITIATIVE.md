# INITIATIVE — Dnyani Mitr, rebuilt

> **This is the source of truth for what we are building and why.**
> Opened 2026-08-24. Maintained until delivery, then archived — not abandoned mid-flight.
>
> **Authority order:** live source code → this document → everything else.
> If this document and the code disagree, the code is right and this document is a defect
> to fix in the same change. Never route around it silently.
>
> **Two planning documents, and only two — this and `ITERATION.md`.** The older ones, `PROJECT_PLAN.md`, `VERSION_3_VISION.md`,
> `ITERATION_2/10/11_PLAN.md`, `RESUME.md`, `docs/ITERATION_11_REVIEW.html`,
> `docs/testing_guide.md` and `docs/laptop_only_deployment_guide.md`, were **deleted 2026-08-24**
> so that a restart or resume lands on a known baseline. Nothing is lost — they are in git:
> `git show 9af1a1f:ngo-visitor-manager/<file>`. **Do not recreate them.**
>
> **`ITERATION.md` carries the current iteration** — objective, measured state,
> plan, and the execution protocol. This file carries what outlives it.
>
> Also present: `README.md` (repo entry point) · `docs/DEVICE_TEST_phase1.md`
> (device gate) · `docs/design-preview-v3.3.html` (design direction, D-11).

---

## 0 · How to use this document

Four sections carry the weight. Read them in this order and you have the whole initiative:

1. **§3 Scope — the six jobs.** If a proposed thing serves none of them, it does not ship.
2. **§4 Principles.** The decision rules. When two options both look reasonable, these break the tie.
3. **§5 Decisions.** Every settled question, with its reasoning and date. **Point at a decision
   ID rather than re-arguing it.** Re-opening one is allowed; doing it silently is not.
4. **`ITERATION.md`.** The current plan, its stages and gates.

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

**PR-6 · Learn from what they already send us.** — *dormant, see D-24.*
The mechanism is right and the tool is built, but it assumed backups arriving from NGOs who
are using the app. **None of the three currently are.** Until that changes, the analyzer is
turned inward: it verifies our own dogfooding runs. The principle reactivates the day a real
backup arrives.

**PR-7 · We are the last line. There is no one downstream.**
The NGOs will not test, so every defect we fail to catch reaches a volunteer as a broken app —
and a second failed adoption is much harder to come back from than the first. Verification is
adversarial and ours: a scripted persona doing a volunteer's day, then the analyzer proving the
app recorded what we believe it did.

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
| **D-16** | 2026-08-24 | ~~Campaigns fate decided by evidence~~ — **SUPERSEDED by D-25.** | ~1,000 lines serving J3 in bulk, built in Iteration 10, never validated. The analyzer answers this in one afternoon. Deleting on suspicion is worse than keeping on evidence. | PROVISIONAL — gate at Phase 0 |
| **D-17** | 2026-08-24 | **Devanagari data-layer hardening lands before any Marathi UI.** | The moment the UI speaks Marathi, people type Marathi. Verified today: `normalizePhone('९८२२०१२३४५') → null`; nukta forms don't match without NFC; `namesSimilar('सुनीता','सुनिता') → false`; `localeCompare` has no locale; CSV has no BOM. Shipping the UI first manufactures bad data. | SETTLED |
| **D-18** | 2026-08-24 | **Fuzzy name matching is a *suggestion*, never an auto-merge.** | A fold key that tolerates IME spelling variance is deliberately aggressive (collapses श/ष/स and aspirates) and will occasionally match different people. Follows the existing rule: a phone match with different names flags a duplicate rather than merging it. | SETTLED |
| **D-19** | 2026-08-24 | **Work continues on a branch off `iter-11-day-release`, not from `main`.** | Iteration 11's contribution is overwhelmingly *service layer* and *defect fixes* — `CalendarService`, the backup/restore repairs, `FileService`, `followUpCompletedAt` — all of which D-03 keeps. Only its view layer is being replaced, and that was being replaced anyway. Discarding it would throw away work we have already decided to keep. Run B still matters, because it verifies migration against real data and migration is service layer. | SETTLED |
| **D-20** | 2026-08-24 | **D-07 refined: the SELF contact needs a phone *or* a name — never neither.** | A hard phone requirement would lose the real case of a caller who rings off before giving a number, and UC-01 already warns that a hard-required field makes staff type `0000000000`, which under last-ten-digit dedup merges unrelated supporters. Requiring *something* still prevents an anonymous empty record that can never be found, thanked or deduplicated. | SETTLED |
| **D-21** | 2026-08-24 | **Lookup searches every contact's phone; sync identity still matches on the SELF contact's first number only.** | Answers P1.7 / the DF-2 gap. A supporter phoning from their spouse's number appeared as a stranger, and intake offered to create a duplicate mid-call. Widening *lookup* helps a human find someone; widening *merge* would fuse two households sharing a landline. Different jobs, different rules — the same principle as D-18. | SETTLED |
| **D-22** | 2026-08-24 | **Branding is fixed at the product level, configurable at the NGO level.** The app is always called **ज्ञानी मित्र / Dnyani Mitr** and always carries the Seva Sankalp mark — neither is editable. Above them sits a **larger, configurable NGO name**. | The NGO's own name is what makes the app feel like theirs, which is exactly what "uncomfort" was about; the product name and mark are provenance and never move. The NGO's label is bigger because the NGO is the user's identity and the app is only the tool. | SETTLED |
| **D-23** | 2026-08-24 | **Marathi first, with a visible toggle to English.** Needs a real string layer — every user-facing string is hardcoded English today. | Answers Q-02. Field volunteers read Marathi first; the toggle protects the coordinators on laptops without making them the default. | SETTLED |
| **D-24** | 2026-08-24 | **We are the pilot. The NGOs will never test.** Verification is entirely ours, and the analyzer's job changes from reading their backups to checking our own dogfooding runs. | Owner confirms none of the three NGOs is currently using the app. There is no downstream check, so every defect we do not catch ships. A scripted persona doing a volunteer's actual day, then the analyzer run against that backup, replaces the pilot we cannot have. | SETTLED |
| **D-25** | 2026-08-24 | **Campaigns: demoted from the nav, code retained.** Not deleted. | D-16 asked whether the evidence justified ~1,000 lines. The evidence is that *nothing* is used, which answers a different question. Deleting on no-usage-of-anything would be deleting on noise; keeping it in primary nav costs one of five slots we cannot spare. Demote is the reversible move. | SETTLED — supersedes D-16 |
| **D-26** | 2026-08-24 | **D-11 confirmed: the ledger design language ships.** P1.8b is unblocked. | Owner reviewed `docs/design-preview-v3.3.html` and confirmed the proposed phone reads as an app. Answers Q-03. | SETTLED |
| **D-27** | 2026-08-24 | **Success is measured by second use, not by retention.** | Adoption from zero is a different problem from retention, with a different test: does someone open it again without being asked. Anything measuring "engagement" over a base of zero is measuring nothing. | SETTLED |
| **D-28** | 2026-08-24 | **The master-key activation gate is removed.** Every device provisions itself silently: a generated `machineId`, role **satellite**, no questions. `KEYS.md` and `ActivationScreen` deleted. | Answers Q-01. The key protected nothing — the valid keys shipped in `KEYS.md` inside the repository, so anyone with the file could type one. What it did do was stand in the doorway: the first screen was a code obtained from us, then "Root or Satellite?" — an architecture question asked of someone with no basis to answer it, before the app had shown them anything worth having. With adoption from zero as the real problem (D-27), a wall at the front door is the most expensive thing in the app. Provenance is now carried properly by D-22: the Seva Sankalp mark is on every screen and cannot be edited, which is a better claim of authorship than a shared code. Satellite is the safe default — a satellite can be promoted, whereas a device wrongly believing it is root claims authority over deletions and propagates it through sync. | SETTLED |

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

**The current plan lives in `ITERATION.md`** — stages, tasks, pre- and
post-conditions, and the execution protocol. It is rewritten each iteration and
its log is folded back into §13 here when the iteration closes.

This document holds what does not change between iterations: what the product
is, who uses it, the six jobs, the principles, every decision with its
reasoning, and the root cause analysis.

---

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
| **Q-01** | **ANSWERED → removed (D-28).** What does the master-key activation gate protect? If licensing or provenance — keep and say so. If it exists because it seemed proper — delete it. | — |
| **Q-02** | **ANSWERED → Marathi first, with a visible English toggle.** Marathi-first or English-first? Ask field volunteers and coordinators **separately** — they will not agree. | — |
| **Q-03** | **ANSWERED → Confirmed — the ledger language ships.** Does binding red (D-11) read correctly to them, or does it carry the wrong meaning? | — |
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

## 13 · Progress log

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

---

## 14 · Root cause analysis — 2026-08-25

Twenty-four defects were found during Phases 1 and 2. The suite was green at
every commit and grew from 323 tests to 682. **Not one of the five most severe
defects was caught by it.**

| Defect | Found by | Would have cost |
|---|---|---|
| Backup and Sync unreachable | reading the diff | **the register**, on the day a phone died |
| laptop → old phone sync dead-ended | a capability matrix written *because* of review | **all sharing**, on the leg used most |
| Palette repoint missed every neutral | reading the diff | a second failed adoption |
| Syntax error in `VisitorList.js` | `vite build` | a white screen |
| Visitors screen still English | **the owner's screenshot** | the original complaint, unfixed |

That table is the finding. Everything below explains it.

### RC-1 · Guards asserted the absence of known-bad, never the presence of required

Every one of these passed while the property it stood for was false:

| The guard checked | What it could not see |
|---|---|
| no banned words ("Overdue", "Machine Role") | a screen entirely in English — P2.9 was ticked on this |
| the component renders | it renders invisibly — the dead button, then `.lg-memories` |
| the route is registered | nothing links to it — Sync unreachable |
| `--lg-*` tokens contrast correctly | the app paints with `--color-*` — neutrals missed |

A proxy held while the property failed. **Absence of specific bad things can
never prove presence of good ones**, and four separate guards made that same
mistake independently.

### RC-2 · A decision lands where I am working, not at every site it governs

- **D-20** (phone *or* name) landed in `validators.js`; `ScheduledItemForm.save()`
  still hard-required a name two commits later.
- **D-07**'s display fallback reached three call sites; `VisitorList` and
  `VisitorView` still rendered "Unknown".
- The nav change removed four tabs and added no entry points.
- The palette repoint covered the semantic tokens and not the neutrals.

Nothing enumerates the affected sites *before* implementation, so the sites I
happen to be looking at get the change and the rest keep the old invariant.

### RC-3 · Silent degradation is JavaScript's default

`StateManager.updateInteraction?.()` on a method that did not exist did nothing,
forever, quietly. `typeof DecompressionStream === 'undefined'` threw advice the
user could not act on. A capability that exists **and throws** — what stale OEM
WebViews actually do — passed the `typeof` check entirely. None of these
announce themselves.

### RC-4 · Untested surface is invisible surface

**~4,500 lines of component code have no test beyond "it parses"** — including
`SyncManager` (906 lines, the screen that saves their register), `VisitorForm`
(689), `ReminderDashboard` (709), `SettingsPage` (571), `VisitorView` (521).

The screens carrying the most untranslated English are *exactly* the untested
ones. Both track the same thing: whether I have touched the file. A syntax error
lived in that surface undetected through 655 green tests.

### What changes

**F-1 · Mutation-test every guard.** Break the thing it protects and watch it
fail, or it is decoration. Done once — `modules-load` — and that is the only
guard here I actually trust.

**F-2 · Assert positive invariants.** "Every route has a door", "every module
loads", "every `--color-*` follows the ledger" — not "no bad word appears".

**F-3 · Enumerate sites before implementing a decision.** When a decision
changes an invariant, grep every site first and record the list in the commit.
The sites are the work; finding them afterwards is luck.

**F-4 · No capability branch without a working fallback.** `typeof X` guards must
degrade to something that functions, and must also survive X existing and
throwing.

**F-5 · A screen a volunteer touches gets a characterization test *before* it is
redesigned.** Redesigning untested code has no safety net, and this is the
largest remaining risk in the codebase.

---
