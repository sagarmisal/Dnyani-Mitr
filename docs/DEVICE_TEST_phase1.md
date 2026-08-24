# Device test — Phase 1, the capture sheet

> Replaces `LOCAL_TEST_v3.2.0.md`. Written for the person holding the phone, not
> for a developer.
>
> **Stop at the first ✗ and report it.** Later steps assume earlier ones passed.

Phase 1 rebuilt **one screen** — the one you use when someone phones to say they
are coming. Everything else looks the same on purpose. What changed underneath
is how the app handles Marathi names and phone numbers.

**Before you start:** take a backup as a WhatsApp *text* message and send it to
yourself. Sync → Backup as text. Not "as file" — file backups taken on a phone
before v3.2.0 were never actually written, so anything you think you saved that
way does not exist.

---

## 1 · It installs over the app you already have

- [ ] The app updates **without uninstalling**
- [ ] After it opens, your visitors are all still there — count them
- [ ] Marathi names read correctly, with no `?` or empty boxes

> If you see **"App not installed"**, stop and tell us. Do **not** uninstall —
> that erases the register. It means the file was signed with the wrong key.

---

## 2 · The capture sheet — the screen that changed

Open the calendar and tap **＋ कुणीतरी येतंय / Someone is coming**.

- [ ] The form **slides up from the bottom** of the screen, not from the middle
- [ ] You can reach every part of it with your thumb
- [ ] The **first field is the phone number**

### 2.1 · A supporter you already know

- [ ] Type the number of someone already in your list
- [ ] While you are still typing, their **name appears** with how many times
      they have visited
- [ ] The name field fills itself in

### 2.2 · Someone new

- [ ] Type a number nobody has yet → it says **नवीन — यादीत जोडले जातील**
      *(new — they will be added to your list)*

### 2.3 · A number that belongs to their family

- [ ] Type a number you have saved for someone's **husband, wife or son**
- [ ] It should still find the family, and say **whose** number it is
- [ ] It should **not** offer to create a second copy of someone you already have

### 2.4 · Tapping instead of typing

- [ ] **कशासाठी / What for** is a row of buttons you tap — not a dropdown list
- [ ] Tapping one turns it a warm yellow
- [ ] Tapping the **same one again clears it**
- [ ] **किती माणसं / How many** is also buttons; tapping **५+** shows a box to type a bigger number
- [ ] **नातं / Relation** is buttons too
- [ ] All the choices are visible **without opening anything**

### 2.5 · The occasion has its own date

- [ ] Choose **🎂 वाढदिवस**
- [ ] More fields appear underneath — they were hidden until now
- [ ] Set the **occasion date to a different day from the visit date**
      (someone often comes on the nearest Sunday)
- [ ] Choose relation **मुलगा/मुलगी · Child** and type a name in **कुणाचा**
- [ ] Save

Then check it actually took hold:

- [ ] The visit appears on the day you chose
- [ ] **माणसं / Visitors** → the new supporter is there
- [ ] Open them → there is a **child contact carrying that birthday**
- [ ] Go to the **occasion's** date in the calendar → the birthday is there,
      and it will be there every year from now on

---

## 3 · The changes you will notice everywhere

### 3.1 · Someone who gave only a number

- [ ] New visit → type a phone number → **leave the name empty** → Save
- [ ] **It saves.** It used to refuse
- [ ] In your visitor list they appear as **98220 12345** — the number, not a blank row

> This is deliberate. A caller who rings off before giving their name is still
> worth recording; the number is what finds them next year.

### 3.2 · Someone who gave only a name

- [ ] Tick **त्यांनी नंबर दिला नाही** *(they did not give a number)*
- [ ] The phone box greys out and warns you it cannot be linked next year
- [ ] Type a name → Save → **it saves**
- [ ] It must store **nothing** in place of the number — never `0000000000`

### 3.3 · Neither

- [ ] New visit with **no phone and no name** → it refuses, and says so plainly

---

## 4 · Searching in Marathi — the part that will surprise you

You type Marathi with the English keyboard, and the phone offers you Devanagari.
That means the same name can be stored two slightly different ways. Search now
copes with that.

- [ ] Search a supporter whose name is in Marathi by **typing it in English** —
      type `sunita`, find **सुनीता**
- [ ] Search someone stored in English by typing **Marathi**
- [ ] Search a name the phone spells with a different **ि / ी** than you picked
      when you saved it — it should still be found
- [ ] Search a phone number **with a space in it** — `98220 12345`
- [ ] Search a nonsense word like `zzzz` → it finds **nothing**
      *(not everything — that would mean matching is too loose)*

---

## 5 · Nothing else broke

- [ ] **Visitors**: add, edit, search, delete
- [ ] **Reminders**: the list shows; snooze and mark-contacted still work
- [ ] **History**: entries readable, pages work
- [ ] **Campaigns**: still opens
- [ ] **Sync**: backup as text, then restore it → everything comes back
- [ ] The visitor list is in a sensible **Marathi alphabetical order**

---

## 6 · Known and expected — not faults

- **The rest of the app still looks the way it did.** Only the capture sheet was
  rebuilt. The new colours are not switched on yet — that waits until you have
  seen the design preview and told us whether it feels right.
- **A 29 February birthday** shows on 28 Feb in the calendar and 1 Mar in
  Reminders. Long-standing, deliberately left alone for now.
- **Notifications and SMS do nothing on a laptop.** Android only.
- **Movable festivals show "needs a date".** Correct — the app refuses to guess
  Diwali, because a greeting to hundreds of people on the wrong day is worse
  than one not sent.

---

## If something fails

Write down: which step, what you expected, what happened. If you can, open the
browser console (laptop: F12) and copy the red text — it names the file and line
and is worth more than a screenshot.

**If any visitor data is missing after the upgrade, stop using the app and tell
us immediately.** Do not add anything new, and do not sync — the backup you took
at the start is the way back.
