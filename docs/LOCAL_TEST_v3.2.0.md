# Local test checklist — v3.2.0 "The Day Release"

Work top to bottom. **Stop at the first ✗ and report it** — later steps assume earlier ones passed.

Two runs matter, and they test different things:

- **Run A — fresh install.** Does the feature work at all?
- **Run B — upgrade with real data.** Does an existing NGO's data survive? *This is the one that
  decides whether the release ships.* A fresh install proves nothing about migration.

---

## 0. Setup

```bash
cd ngo-visitor-manager
npm install
npx vitest run      # expect: 323 passed
npx vite build      # expect: dist/index.html
npm run dev         # http://localhost:3000
```

- [ ] 323 tests pass
- [ ] Build succeeds
- [ ] Dev server starts

> Browser console open throughout (F12). **Any red error is a failure**, even if the screen looks fine.

---

## RUN A — fresh install

Use a **private/incognito window** so you start with empty storage.

### A1. Activation
- [ ] Activation screen appears
- [ ] It shows **Version 3.2.0** (not "Version 2.0" — that was a long-standing bug)
- [ ] The red note is visible: *"Already using Dnyani Mitr and seeing this screen?"*
- [ ] Activate with `SSP-DEV1-2026-TEST`, name `Test-Root`, role **Root**

### A2. The calendar is the landing screen
- [ ] It opens on **Calendar**, not My Day
- [ ] Nav reads: Calendar · My Day · Visitors · Reminders · Campaigns · History · Sync · Settings
- [ ] Month grid shows 6 rows × 7 days; today is outlined
- [ ] `‹` `›` change month; **Today · आज** returns to today
- [ ] **15 August** shows a dot (Independence Day, seeded)

### A3. Inbound intake — the primary flow
- [ ] Click **＋ Someone is coming** → a **centred modal over a dark overlay** appears
      *(if nothing seems to happen, scroll down — that was the CSS bug, now fixed)*
- [ ] The **first field is the phone number**
- [ ] Type `9123456780` → it says *"New supporter — they will be added to your list"*
- [ ] Name: `रमेश जाधव` · Title: `रमेश जाधव यांची भेट`
- [ ] Occasion: **Birthday**, occasion date **2020-08-18**, relation **CHILD**, whose: `मुलगी`
      — note the occasion date is deliberately *different* from the visit date
- [ ] Save → the modal closes, a toast confirms, and the visit appears under **Coming to us**

Then verify the graph actually grew:
- [ ] **Visitors** → `रमेश जाधव` exists
- [ ] Open him → there is a **CHILD** contact `मुलगी` carrying **18 Aug 2020** as a birthday
- [ ] **Calendar → 18 August** → that birthday now appears as a reminder, every year, unprompted

### A4. Phone-first identity resolution
- [ ] **＋ Someone is coming** → type `9123456780` again
- [ ] It finds **रमेश जाधव** and shows his interaction count — the name auto-fills

### A5. "Caller didn't give a number"
- [ ] New inbound visit → tick **Caller did not give a number**
- [ ] The phone field disables and warns it cannot be linked next year
- [ ] Save with a name → it saves. **It must store nothing in place of the number** (never `0000000000`)

### A6. Completion — the no-show path
- [ ] On an inbound visit click **Done** → it asks **"Did they come?"**
- [ ] Answer **No, they did not** → **History** must show **no** new interaction
- [ ] On another linked inbound visit answer **Yes** → **History** shows a new visit interaction

### A7. Outbound plans and catch-up
- [ ] **＋ Plan a visit** on a **past** day, save
- [ ] Return to today → it appears under **Needs catching up** with a count badge
- [ ] That past day shows a red border and `!` in the grid
- [ ] The catch-up list shows at most **5** items, then **"+N more"**

### A8. Day pane order (this is a decision, not a detail)
- [ ] Order is: **Coming to us → Needs catching up → We are going → On this day**

### A9. My Day is alive, both ways
- [ ] **📋 Today's summary** → My Day opens and works
- [ ] My Day has **🗓 Open the calendar** → returns

### A10. The kill switch
- [ ] **Settings → Opening screen → My Day** → Save → reload → app opens on **My Day**
- [ ] Set it back to **Calendar** → reload → opens on Calendar

### A11. Festivals
- [ ] **Campaigns → Occasions**: Diwali, Ganesh Chaturthi, Gudi Padwa, Holi, Dussehra, Eid are listed
- [ ] They show as **needing a date** — this is correct. The app refuses to guess a lunar date.
- [ ] Fixed ones (Independence Day, Makar Sankranti, Christmas…) have real dates

### A12. Backup and restore — the safety net
- [ ] **Sync → Backup as text** → text appears and is copied
- [ ] Add a visitor, delete another, so state differs
- [ ] **Sync → Restore**, paste the text → confirm
- [ ] After reload: visitors, **occasions**, **campaigns**, **plans** and settings are all back
      *(before this release, occasions and campaigns were silently lost here)*

### A13. Send plans
- [ ] **Sync → Send plans** → output starts with a readable line:
      *"📅 Dnyani Mitr — N plans from …  Needs app version 3.2.0 or later."*
- [ ] It is **one message**, not several

---

## RUN B — upgrade with real data ⚠ the one that decides the release

Use a **normal window**, and a **copy** of real NGO data.

- [ ] On the **current v3.1.0 install**, do **Sync → Backup as text** and keep it safe
- [ ] Open the new build (dev server or the new `dist/index.html`), activate
- [ ] **Sync → Restore** → paste that v3.1.0 backup

Then confirm nothing was lost or corrupted:
- [ ] Visitor count matches the old install exactly
- [ ] Marathi names render correctly — no `?` or boxes
- [ ] Interaction history is intact
- [ ] Reminders tab shows the same upcoming birthdays as before
- [ ] Campaigns are present
- [ ] Settings survived (org name, tagline, templates)
- [ ] Calendar shows those visitors' birthdays on the right days
- [ ] **No red console errors during or after the restore**

---

## Regression — things this release must NOT have broken

- [ ] **Visitors**: add, edit, search, soft delete
- [ ] **Reminders**: list renders; snooze and mark-contacted still work
- [ ] **Campaigns**: a campaign can still be built and previewed
- [ ] **History**: pagination works; entries readable
- [ ] **Sync**: normal export/import between two browser profiles still merges

---

## Known and expected — not bugs

- A **29 Feb** birthday shows on **28 Feb** in the calendar but **1 Mar** in Reminders. Pre-existing
  divergence between two date helpers, both pinned by tests; alignment deliberately deferred.
- **Notifications and SMS do nothing on a laptop.** Android-only, no-ops on desktop by design.
- **File share / "open from WhatsApp"** does nothing on a laptop. Android-only (Phase F).
- Movable festivals showing "needs a date" is **correct**, not a defect.

---

## If something fails

Note: the step number, what you expected, what happened, and **the console error text**.
The console text matters more than the screenshot — it usually names the file and line.
