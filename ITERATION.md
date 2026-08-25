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

### Stage 0 · Reconcile the ledger — *first, or "done" is unreachable*

The old task list carries entries that decisions already superseded: tasks
asking for answers the owner has given, and tasks assuming NGOs are using the
app when D-24 records that none are. A list with stale entries can never reach
zero.

- **Post:** every open item is one a person could start today; each has an owner
  and a stage; none contradicts a SETTLED decision.
- **Check:** a script lists open items and their stage. **Orphans must be zero.**

### Stage A · Make completeness provable — *and it starts red*

- Six acceptance tests, `J1`…`J6`, each walking the real screens end to end.
- A coverage floor: no component over 200 lines without a real test.
- **J2 and J4 are expected to FAIL.** That is the exit condition, not a blocker.
- **Rule:** if a failing test later has to be *edited* to pass, **the test was
  wrong and that is a separate finding** — not a step.

### Stage B · Close what Stage A exposed

- **B1 (J4)** — test `ReportService`; build the Reports screen: date range,
  filters, live counts, BOM'd CSV, trustee columns.
- **B2 (J2)** — characterize `ReminderDashboard`, then rebuild it on the kit.
- **Check:** the exact tests that were red pass **unedited**.

### Stage C · The six untouched screens

Fixed order per screen: **characterize → redesign → translate.**

`SyncManager` (906, and the only screen whose failure is unrecoverable) →
`VisitorForm` (689) → `VisitorView` (521) → `ReminderDashboard` → `SettingsPage`
(571) → batch `MyDayDashboard`, `InteractionHistory`, `GreetingQueue`,
`SmsBatchQueue`.

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
| 8 | Suite · build · reachability · ratchet — all green | |

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
