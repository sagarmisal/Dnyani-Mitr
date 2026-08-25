# ITERATION — Make it deliverable

> **This is the current iteration, and only ever the current one.** When it ends,
> its log is appended to `INITIATIVE.md` and this file is rewritten for the next.
>
> **`INITIATIVE.md` holds what does not change between iterations** — what the
> product is, the six jobs, the principles, every numbered decision with its
> reasoning, and the root cause analysis. This file holds only what this
> iteration is doing about it.
>
> Authority: **live code → `INITIATIVE.md` decisions → this file → anything else.**
>
> Opened 2026-08-25.

---

## 1 · In one sentence

**Finish the app so it can be given to three NGOs without a person standing next
to them.**

Not new features. The six jobs in `INITIATIVE.md §3` are the whole scope. This
iteration closes the distance between "the parts I rebuilt work" and "all of it
works, in their language, on their phones, provably."

---

## 2 · Why this iteration exists

### What we believed at the start of the initiative

That the NGOs were using v3.2.0 and finding it awkward, so improving the surface
would improve retention.

### What turned out to be true

**None of the three is using it at all.** That is not a retention problem, it is
adoption from zero, and it means:

- there is no usage evidence and never was — the analyzer reads backups nobody is sending
- **nobody downstream will catch a defect.** We are the last line
- a *second* failed adoption is far harder to recover from than the first

### The five defects that shaped this iteration

Every one was found by reading, by the build, or by the owner — **none by the
test suite**, which was green at 682 throughout.

| | What was wrong | What it would have cost |
|---|---|---|
| 1 | **Backup and Sync had no link from anywhere.** The nav went 8 tabs → 5 and the replacement doors were never added | the register, on the day a phone died |
| 2 | **laptop → old phone sync dead-ended.** The receiver needed a decompressor it did not have, and the error told the user to do something the UI does not offer | all sharing, on the leg used most |
| 3 | **The palette repoint missed every neutral.** Warm accents on a cool-grey Tailwind ground | it would have looked unchanged — a second failed adoption |
| 4 | **A syntax error passed 655 green tests**, because no test imported that file | a white screen |
| 5 | **A screen still entirely in English**, ticked as done against a guard that only looked for banned words | the original complaint, unfixed |

The pattern is in `INITIATIVE.md §14`. The short version: **my guards asserted the
absence of known-bad things and never the presence of required ones**, so a proxy
kept passing while the property failed.

---

## 3 · Where we actually are — measured, not remembered

### Working, with tests that model real use

| | Job | |
|---|---|---|
| **J1** | Record a visit | dogfood week through the real capture sheet · phone identity · Devanagari both directions |
| **J3** | Reach out and remember | never claims what it cannot know · never addresses anyone by their phone number |
| **J5** | Never lose the register | backup → wipe → restore · a real v3.1.0 register upgraded intact |
| **J6** | Keep NGOs in step | six device legs including laptop → old phone · gzip reader fuzzed against zlib |

### Not working

| | Job | |
|---|---|---|
| **J2** | Who to reach out to today | the calendar half is tested; `ReminderDashboard` is **709 lines, no tests, no translation** |
| **J4** | Prove the work | the **अहवाल** tab goes to My Day. `ReportService` has **no test of any kind**. **A coordinator cannot produce a trustee report today** |

### Untouched

- **12 of 21 components — ~4,600 lines — no real test**
- **186 untranslated strings**, worst in Settings, VisitorView, Reminders, VisitorForm
- Those are the same files. Both track one thing: whether I have touched it

### Never verified

**Nothing has run on a real Android device.** Not one screen, not the file share,
not the WebView rendering on a Redmi or an Oppo. Every claim about mobile in this
project is code-verified only, and that phrase should appear beside every such
claim until a device has said otherwise.

---

## 4 · What we are trying to achieve

In the NGO's terms, not ours. Each maps to a job.

1. **A volunteer records a visit while the caller is still talking** — phone
   first, everything else a tap. *(J1 — done)*
2. **Opening the app answers "what do I do today?"** without navigating. *(J2)*
3. **Nobody who helped is forgotten** — a thank-you goes out and the app
   remembers it went. *(J3 — done)*
4. **The coordinator produces the trustee number in a minute, not an afternoon.**
   *(J4)*
5. **A dead phone costs nothing** — the register comes back from a WhatsApp
   message. *(J5 — done)*
6. **Three NGOs stay in step with no server**, laptop and phone alike. *(J6 — done)*
7. **Every screen speaks Marathi**, with English one tap away. *(cross-cutting)*
8. **No screen can be reached only by knowing a URL.** *(cross-cutting)*

---

## 5 · What "done" means

Seven checks. Not a feeling, not a judgement, and not negotiable.

| | Check | Who can prove it |
|---|---|---|
| 1 | **J1–J6 acceptance tests green** | me |
| 2 | **Zero** untranslated strings | me |
| 3 | Every component over 200 lines has a real test | me |
| 4 | Every screen has a door — reachability green | me |
| 5 | `verify-apk.sh` prints **Signature matches** | me |
| 6 | **The device run passes** on one real phone and one laptop | **owner only** |
| 7 | A backup from the phone restores on the laptop, **and the reverse** | **owner only** |

**6 and 7 cannot be self-certified.** Everything in 1–5 is code-verified, and no
quantity of it substitutes for one real device.

---

## 6 · The plan

### Stage 0 · Reconcile the ledger ✅ *done 2026-08-25*

The old ledger was **deleted** rather than reconciled when the docs were split,
so the first act of Stage 0 was to recover it from git and check that nothing
real had gone with it. Every one of its 68 tasks now has a home:

| Old task | Disposition |
|---|---|
| P0.1, P1.*, P2.* | Done — the work of Phases 1 and 2 |
| P0.3, P0.4 | **Obsolete.** They collect and analyse NGO backups; D-24 records that no NGO is using the app, so none exist. The analyzer's job turned inward and the dogfood run is what it reads now |
| P0.5 | Superseded by D-25 |
| P0.6, P0.7 | Answered by the owner (D-26, D-28) |
| P0.2, P0.8, P3.4, P3.10, P5.1, P5.6–P5.9 | → **Stage F** (owner, device) |
| P3.1, P3.2, P3.3 | → **Stage B1** (Reports) |
| P3.5 | → **Stage C** (`SyncManager` rebuild) |
| P3.7 | Already done — the absent-≠-empty regression exists |
| P3.8, P3.9 | Already done — plans export/merge built, 325 lines of tests |
| P5.2–P5.5, P5.10 | → **Stage E** |

**One genuine gap found: P3.6, the backup-age nudge, was never built.** PR-5 says
we ask these NGOs for exactly one behaviour — *take a backup before you upgrade* —
and nothing in the app asks. It is now **Stage B3**, and it goes on **Today**, not
inside Sync: a nudge nobody passes is not a nudge.

- **Check:** 68 old tasks, 68 dispositions, zero orphans.

### Stage A · Make completeness provable ✅ *done 2026-08-25 — and it is red, as planned*

`tests/jobs/J1…J6` walk the real screens end to end. `tests/coverage-floor.test.js`
ratchets the number of large untested components.

**720 tests. Six red, every one of them named and deliberate:**

| Red test | Closed by |
|---|---|
| J4 · the coordinator can ask for one month | **B1** |
| J4 · what was brought can be counted | **B1** |
| J4 · there is a reports screen behind अहवाल | **B1** |
| J2 · the screen itself has a test | **B2** |
| J2 · the screen speaks Marathi | **B2** |
| coverage · critical screens are covered (`SyncManager`) | **C** |

**Two defects found by writing the tests:**

1. **`generateVisitorCSV()` returned headers and no rows.** `getAll()` filters on
   `status === 'active'`; the model defaults it and the v2 migration sets it, but
   `SyncService.merge` assigns plain objects and bypasses both. **A visitor
   arriving from another phone without `status` would sit in storage and appear
   nowhere** — no list, no search, no report, no error. Backfilled in
   `ensureForwardFields`, with a test.
2. **The coverage guard passed itself.** It counted name *mentions*, and its own
   list of critical screens made `SyncManager` look covered — a comment in
   another test supplied the second mention. Replaced with an import check; the
   honest count of untested large components is **11, not 6**.

The second one is RC-1 committed *inside the guard written to prevent RC-1*.

### Stage B · Close what Stage A exposed ✅ *done 2026-08-25*

**B1 (J4)** — `ReportService` characterized first, then given a date range,
contribution counts and `summarise()`. `ReportsPage` built on the kit and wired
to the **अहवाल** tab, which until now landed on My Day. Opens with this month
already showing, because a report screen that opens empty is a form.

**B2 (J2)** — `ReminderDashboard` characterized (9 tests, 709 lines that had
none), then translated behind that net. Zero English left in the file.

**B3 (PR-5)** — the backup nudge, on **Today**. Appears when no backup exists or
the last is over a fortnight old, states the fact, offers the action, and
dismisses for a week — not forever, because the risk does not go away because
someone was busy.

**All six of Stage A's red tests are green**, and none of them was edited to get
there — except one, which is recorded below as a finding.

**Three findings:**

1. **A J4 test was wrong, not the code.** It asserted
   `generateVisitorCSV.length > 0` to prove a date range existed. `Function.length`
   counts parameters *before* the first default, so a destructured
   `({from, to} = {})` reads as zero arity. **RC-1 for the third time:** a proxy
   that could not see the property. Rewritten to assert that a range actually
   narrows the result.
2. **I reintroduced the single-quote interpolation bug**, the one that broke
   `VisitorList` and that `modules-load` was written to catch. It caught it in
   seconds. The guard works; the *tool* — blind string replacement with no
   awareness of quoting — is the hazard.
3. **A characterization test went vacuous.** It asserted the screen still carried
   English so it would go red when the sweep arrived. It never did: it was
   matching variable names like `upcoming` and `ReminderService`. Replaced with
   the positive property — no user-visible English — rather than edited to pass.

### Superseded plan text for Stage B

- **B1 (J4)** — test `ReportService`; build the Reports screen: date range,
  filters, live counts, BOM'd CSV, trustee columns.
- **B2 (J2)** — characterize `ReminderDashboard`, then rebuild it on the kit.
- **B3 (PR-5)** — the backup-age nudge, on **Today**. Derived from `syncLog`:
  how long since a backup, shown where they already look, dismissible. Found
  missing in Stage 0 — the one behaviour we ask for had nothing asking for it.
- **Check:** the exact tests that were red pass **unedited**.

### Stage C · The six untouched screens

Fixed order per screen: **characterize → redesign → translate.**

✅ `SyncManager` (906) → ✅ `VisitorForm` (689) → ✅ `VisitorView` (521) →
✅ `ReminderDashboard` (B2) → `SettingsPage` (571) → batch `MyDayDashboard`,
`InteractionHistory`, `GreetingQueue`, `SmsBatchQueue`.

> **Correction.** I described `VisitorForm` repeatedly as "fifteen fields shown
> where one is required". **It is a three-step wizard** — Primary / Family /
> Details — and has been throughout. Progressive disclosure was already there;
> what was wrong was the *rule* it enforced, not its shape. The claim came from
> counting `<label>` tags in the file rather than opening the screen.

- **Post per screen:** characterization still green and unedited · kit components
  used, no new one-off CSS · zero English in that file · ratchet lowered.
- One commit per screen, so any single screen can be reverted whole.

### Stage D · Language to zero

Ratchet 186 → **0**, then flip the guard from "may not rise" to "must be zero".

### Stage E · The deliverable that is not the app

Device checklist · one laminated card for beside the office phone · volunteer
instructions · laptop note · the previous APK retained as rollback, path recorded.

### Stage F · The device run — *owner*

The only thing that makes any of the above real.

---

## 7 · How every task is executed

Binding. Each step is one of the four root causes in `INITIATIVE.md §14`,
inverted — this is those failures turned into a procedure.

| | Step | Prevents |
|---|---|---|
| 1 | **Enumerate the sites first.** Grep everywhere the change must land; record the count in the commit | a decision landing in one file and not its siblings |
| 2 | **Characterization test green before touching a redesign** | redesigning untested code with no safety net |
| 3 | Implement | |
| 4 | **Assert the positive property**, never the absence of its violation | four guards independently checked for bad words instead of good state |
| 5 | **Mutation-test the guard** — break it, watch it fail, restore | an unmutated guard is decoration |
| 6 | **Re-run step 1's enumeration. It must return zero** | half-applied changes |
| 7 | Capability branches: test **absent** *and* **present-but-throwing** | OEM WebViews expose an API then fail on use |
| 8 | **Run `vite build` immediately after any bulk source edit**, before moving to the next file | a parse error entering a file nothing imports |
| 9 | Suite · build · reachability · ratchet — all green | |

> **Stop using pattern replacement on source.** The single-quote interpolation
> bug happened five times, and the last round proved the tooling is the problem
> rather than my attention: a regex written to *fix* it converted
> `onclick="...hash='${ROUTES.VISITORS}'"` — which was correct — into a broken
> template, and then converted the *inner* quote of `${t('key')}` instead of the
> outer delimiters. Each attempt to automate the fix created new breakage.
>
> From here: translate by exact string replacement only, one pair at a time, and
> **build after every file** (step 8). That combination caught every instance
> within seconds instead of at the end of a batch.
>
> **On the single-quote interpolation bug.** I made it three times — `VisitorList`,
> `ReminderDashboard`, `SyncManager` — always from a replacement script that did
> not know what kind of quote it landed inside. I tried to build a guard for it
> and stopped: a regex flagged 70 innocent lines, a line-by-line quote tracker
> flagged 129 (HTML inside a multi-line template is not JavaScript), a small
> lexer got to 4 and still wrong. Answering it properly needs a real parser, and
> a guard with known false positives is worse than none because it teaches people
> to skip it.
>
> The fatal form is already caught by `modules-load`. The fix for the rest is
> step 8 above — **build after every bulk edit** — which would have caught all
> three within seconds. The failure was process, not tooling.

> **A task is not done when the code works. It is done when step 6 returns zero
> and step 5 has been seen to fail.**

---

## 8 · Risks, and what would invalidate this plan

| Risk | Standing |
|---|---|
| The kit renders badly on a real OEM WebView | **Unknown — nothing has been on a device.** Stage F is the only answer, and everything in Stage C assumes it is fine |
| The Marathi does not read naturally | Unknown. I wrote all of it and am not a native speaker. Cheap to fix now, expensive after rollout |
| Redesigning untested screens loses behaviour | Mitigated by characterize-first, but that is a mitigation, not a proof |
| Second-system creep | §3's six jobs are the scope. A seventh needs a decision entry, not an accommodation |

**Stop and re-plan — do not push on — if:**

- the device run fails on rendering or storage: Stage C's assumptions were wrong
  and everything after it is suspect
- a screen's behaviour is too undefined to characterize: that is a finding about
  the screen, not permission to skip
- the Marathi comes back materially wrong: Stage D becomes re-translation and
  moves ahead of Stage C

---

## 9 · Progress log

Append-only. One line per event.

- **2026-08-25** — Iteration opened. Scope: finish, do not extend. Split from
  `INITIATIVE.md`, which keeps the durable record — jobs, principles, decisions,
  RCA — while this file carries the current plan and dies with it.
- **2026-08-25** — **Stage C.4 done (`SettingsPage`).** No defects — the first screen this
  iteration to characterize clean. Its tests pin the thing that nearly shipped broken:
  Settings holds the only door to Backup since the nav went to five tabs, and **backup must
  be first** among those links, because PR-5 makes it the one behaviour we ask for rather
  than another row in a list. Vocabulary moved from ours to theirs — "Machine Information"
  became "हा फोन / This device", "Lapse Threshold (days)" became "किती दिवसांनी भेट नाही
  म्हणायचं". 784 tests; i18n 122 → 85.
- **2026-08-25** — **Stage C.3 done (`VisitorView`).** Characterization found four defects
  before a line was redesigned: a visitor whose `contacts` array is missing **crashed the
  screen** (and such records arrive through merge as plain objects), a contact without
  phones or emails crashed it, a nameless visitor rendered "Unknown Visitor" against D-07,
  and unparseable dates printed **"Invalid Date"** to a volunteer. `formatDate` now returns
  an em dash rather than "N/A" or "Invalid Date" — both are developer words that say
  *broken* when the truth is *we do not have this*. That fix reaches every screen.
  Also confirmed by mutation: **`modules-load` does not catch a duplicate import; the build
  does.** The suite and the build catch different classes of error and neither subsumes the
  other, which is why step 8 is not optional. 775 tests; i18n 142 → 122.
- **2026-08-25** — **Stage C.1–C.2 done.** `SyncManager`: characterization found that a
  malformed `syncLog` entry — which arrives through merge from *other machines* — crashed
  the one screen that recovers a register, plus three undefined CSS classes on its action
  layout. `VisitorForm`: characterization found it still **demanded a name**, the rule D-20
  replaced, on the second capture path — RC-2 again, the decision having reached the
  validator and the calendar sheet but not its sibling. Both translated. Also corrected a
  claim I had repeated in the planning docs: VisitorForm is a wizard, not a flat form.
  765 tests; i18n 163 → 142.
- **2026-08-25** — **Stage B done.** J4 has a real Reports screen behind the अहवाल
  tab; J2's 709-line screen has 9 characterization tests and zero English; the
  backup nudge exists at last. 747 tests, one red (`SyncManager`, Stage C's first
  item). i18n ratchet 186 → 163.
- **2026-08-25** — **Stage A done, deliberately red.** 720 tests, six failing, each
  named and assigned to the stage that closes it. Writing them found two defects:
  a visitor without `status` is invisible everywhere while sitting in storage
  (fixed), and the coverage guard was satisfied by its own critical-screens list
  — RC-1 committed inside the guard written to prevent RC-1. The honest count of
  untested large components is 11, not the 6 the fakeable proxy reported.
- **2026-08-25** — **Stage 0 done.** The old ledger had been deleted rather than
  reconciled during the split, so it was recovered from git and every one of its
  68 tasks given a disposition. Four are obsolete under D-24, two were already
  answered, three were already built. **One real gap: the backup-age nudge (P3.6)
  was never built** — PR-5 asks these NGOs for exactly one behaviour and nothing
  in the app asks for it. Added as Stage B3, on Today rather than inside Sync.
