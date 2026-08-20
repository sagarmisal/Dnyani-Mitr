# RESUME — where this project is, right now

> Created 2026-08-20. Three earlier plans instructed someone to "refresh the stale RESUME.md";
> it had never existed. This is that file.
>
> **Read this first, then `ITERATION_11_PLAN.md` for the full sequenced detail.**
> Authority order: **live code > this file > any other doc.** If they disagree, the code is right
> and the doc is a defect to fix in the same change.

## State

| | |
|---|---|
| Version | **v3.2.0 / versionCode 11** (bumped from 3.1.0 / vc10) |
| Tests | **314 passing**, 21 files |
| Build | `dist/index.html` ~441 kB, ~153 kB gzip |
| Git | **nothing committed** — all work is in the working tree |
| Last commit | `20475ff` docs: Iteration 9.5 + 10 records (v3.1.0) |

## What Iteration 11 changed

The calendar is now the landing screen, and **inbound visits lead the day** — a supporter phoning
to say they are coming is the primary flow, not a volunteer planning to go out.

Along the way it repaired seven pre-existing defects, none caused by the calendar, all found by
auditing how this release would actually reach three remote NGOs:

1. The "full" backup omitted `occasions` and `campaigns` — a restore after reinstall lost them.
2. A full-backup **file** could not be restored at all; the file path always merged, dropping six collections while reporting success.
3. `saveFile()` failed on all three of its Android paths **and reported success anyway** — the app claimed backups it had never written.
4. Movable festivals could not be represented, while code comments claimed they could.
5. The signing key that controls every future upgrade was an un-backed-up 2.6 KB file.
6. CI published APKs signed with a per-run throwaway key — uninstallable over the existing app.
7. "Visit" meant the wrong thing: the calendar had been built outbound-first.

## Verify locally on a laptop

```bash
cd ngo-visitor-manager
npm install
npx vitest run          # expect 314 passing
npx vite build          # expect dist/index.html
npm run dev             # http://localhost:3000
```

Then, in the browser — this is the acceptance walk, not a tour:

1. **The calendar opens first.** Month grid, today outlined, `‹ ›` move months, **Today** returns.
2. **"＋ Someone is coming"** → type `9876543210` (an existing visitor's number): the name and their
   history appear. Type an unknown number: it offers to add them.
3. Fill in an occasion — type *Birthday*, relation *CHILD*, a name, and an occasion date **different
   from the visit date**. Save. A new supporter is created **with the child as a CHILD contact
   carrying that birthday**, which the reminder engine will surface every year from now on.
4. **Day pane order** is: Coming to us → Needs catching up → We are going → On this day.
5. Mark an inbound visit **Done** → it asks *"Did they come?"*. Answer **no**: no interaction is
   written. Answer **yes** on a linked visit: an Interaction appears in History.
6. **My Day still works** at `#/dashboard`, linked from the day pane, and links back.
7. **Settings → Opening screen** → *My Day* → reload → it opens on My Day. That is the kill switch.
8. **Sync → Send plans** → one message, with a human-readable header above the data block.
9. **Backup as text** → **Restore** it → visitors, occasions, campaigns and plans all return.
10. **Settings → About** shows **3.2.0**.

## Before pushing for an APK build — read this

**A GitHub Actions APK CANNOT be given to a volunteer.** The runner generates a fresh debug keystore
on every run (nothing restores `~/.android`), so each CI APK is signed with a different throwaway key
and **will not install over the app already on the NGO devices**. A volunteer who tries sees
*"App not installed"*, and the advice they will find online — uninstall first — destroys their data.

CI is for smoke-testing that the Android build compiles. That is all. The artifact is named
`app-debug-CI-TESTING-ONLY.apk` to make that hard to forget.

**The distributable APK is built on the maintainer's laptop**, which holds the keystore that signed
what is already installed:

```bash
npx vite build && npx cap sync android
cd android && ./gradlew assembleDebug          # requires Java 21
cd .. && ./scripts/verify-apk.sh               # MUST print "Signature matches"
```

## Open owner actions

- [ ] **Back up `~/.android/debug.keystore`** off-machine, encrypted, in two places. Highest
      value-per-minute action in the project: it is the only thing that keeps the fleet upgradeable.
- [ ] Treat every existing "file backup" taken on a phone as **non-existent** (defect 3 above) and
      ask each NGO to re-take one as a WhatsApp text message.
- [ ] Ask the four laptop users which browser they open the app in; the guide standardises on
      Chrome or Edge.
- [ ] Pick the pilot volunteer — one phone, one laptop, upgraded first, 48-hour soak before the rest.
- [ ] Decide the bundle budget: the build is ~441 kB against a 420 kB ceiling written when this was
      a one-workstream release. Recommendation is to raise it to 460 kB.
- [ ] Source and confirm the movable-festival dates (Diwali, Ganesh Chaturthi, Gudi Padwa, Holi,
      Dussehra, Eid) from a verified almanac. They are seeded by name with **empty** date tables on
      purpose — the app asks rather than guessing, because a festival greeting sent to hundreds of
      supporters on the wrong day is worse than one not sent at all.

## Not done

Phase F1–F4 (native file sharing and open-from-WhatsApp) is written and unit-tested, but **no test
proves anything about how MIUI or ColorOS behave**. It is verified on the pilot phone or shipped
switched off via `FEATURES.nativeFiles` in `src/utils/constants.js`.

E5–E7 remain: the APK build, the device pilot, and the volunteer instructions.
