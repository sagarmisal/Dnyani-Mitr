# Device test — v3.3.0

> Replaces `DEVICE_TEST_phase1.md`. Written for the person holding the phone.
>
> **Stop at the first ✗ and report it.** Later steps assume earlier ones passed.
>
> Everything in this app is **code-verified only**. Nothing has run on a real
> Android device. This checklist is the first time it does, and it is the only
> evidence that counts.

**Before anything else:** on the phone you are about to upgrade, take a backup
as a WhatsApp **text** message and send it to yourself.
Settings → बॅकअप आणि शेअर → copy → send.

Not "as a file". File backups taken on a phone before v3.2.0 were never actually
written, so anything saved that way does not exist.

---

## 1 · It installs over what is already there

- [ ] The app updates **without uninstalling**
- [ ] After it opens, every visitor is still there — count them against the old number
- [ ] Marathi names read correctly, no `?` and no empty boxes

> **"App not installed" means stop.** Do not uninstall to fix it — that erases
> the register. It means the file was signed with the wrong key. Tell us.

---

## 2 · It opens in Marathi, and it is theirs

- [ ] The whole app is in **Marathi** — every screen, every button
- [ ] **मराठी | English** in the top corner switches the language, and the choice
      survives closing and reopening the app
- [ ] The NGO's own name is the **largest** thing at the top
- [ ] The Seva Sankalp mark is beside it
- [ ] Settings → संस्थेचं नाव changes that name

> Anything still in English is a defect. Write down which screen.

---

## 3 · Recording a visit — the thing they will do most

Tap **＋ कुणीतरी येतंय**.

- [ ] The form **slides up from the bottom**, and your thumb reaches all of it
- [ ] The **first field is the phone number**
- [ ] Typing a number you already have shows the name and how many times they came
- [ ] Typing a new number says **नवीन — यादीत जोडले जातील**
- [ ] Typing a number saved for someone's **husband, wife or son** finds the family,
      says whose number it is, and does **not** offer to add them twice
- [ ] **कशासाठी** is a row of buttons you tap, not a dropdown
- [ ] Tapping the same button again clears it
- [ ] **किती माणसं** is buttons; **५+** reveals a box for a bigger number

Then the part that matters most:

- [ ] Choose **🎂 वाढदिवस**, set the **occasion date to a different day from the
      visit**, choose **मुलगा/मुलगी**, type a name, save
- [ ] माणसं → the new supporter is there
- [ ] Open them → a child contact carries that birthday
- [ ] Go to the **occasion's own date** in the calendar → the birthday is there,
      and will be every year

---

## 4 · The rules that are easy to get wrong

- [ ] New visit → type **only a phone number**, no name → **it saves**
- [ ] That person appears in the list as **98220 12345** — the number, not a blank row
- [ ] New visit → tick **त्यांनी नंबर दिला नाही**, type only a name → **it saves**
- [ ] It stores **nothing** in place of the number — never `0000000000`
- [ ] New visit with **neither** → it refuses and says why
- [ ] माणसं → **नवीन व्यक्ती** → the same rules apply there

---

## 5 · Searching, the way you actually type

You type Marathi with the English keyboard. The same name can end up spelled two
ways. Search copes with that.

- [ ] Type `sunita` in English → finds **सुनीता**
- [ ] Type Marathi → finds someone stored in English
- [ ] Search a name the keyboard spells with a different **ि / ी** than you chose
      when saving → still found
- [ ] Search a number **with a space** — `98220 12345`
- [ ] Search nonsense like `zzzz` → finds **nothing** (not everything)

---

## 6 · Today, and a year ago

- [ ] The app opens on **आज** with four counts at the top
- [ ] Four large buttons underneath
- [ ] The day's list is below the calendar, in this order:
      **आज येणारे → बऱ्याच दिवसांत भेट नाही → आपण जाणार → गेल्या वर्षी आज**
- [ ] If you have last year's visits, **गेल्या वर्षी आज** shows someone
- [ ] It offers **💐 आभार पाठवा**, and only offers **तुमची आठवण येते** for
      someone you have not seen in months

---

## 7 · Backup and sharing — the part that saves them

- [ ] सेटिंग → **बॅकअप आणि शेअर** is there and opens
- [ ] Backup as text → a message appears and copies
- [ ] Send it to yourself on WhatsApp — count how many messages it is
- [ ] Add a visitor, delete another, so the data differs
- [ ] Restore from that message → everything comes back, including campaigns and occasions
- [ ] **No red errors** in the process

**Then the two directions that must both work:**

- [ ] A backup taken on the **phone** restores on the **laptop**
- [ ] A backup taken on the **laptop** restores on the **phone**

> The second one is the leg that was broken until this release. Do not skip it.

---

## 8 · The report

- [ ] अहवाल opens showing **this month already** — not an empty form
- [ ] Counts appear: भेटी, माणसं, काही आणलं, आभार पाठवले
- [ ] Switch to **मागचा महिना** → the numbers change
- [ ] **यादी उतरवा (CSV)** downloads a file
- [ ] Open that file — Marathi names read correctly, **not** as `à¤¸à¥`

---

## 9 · The backup nudge

- [ ] On a phone with no recent backup, **आज** shows a reminder to back up
- [ ] It offers **आत्ता बॅकअप घ्या** and **नंतर**
- [ ] **नंतर** hides it — and it comes back after about a week

---

## 10 · Nothing else broke

- [ ] माणसं: add, edit, search, remove
- [ ] आठवणी: the list shows, snooze and mark-contacted work
- [ ] सेटिंग → इतर → all four links open something
- [ ] WhatsApp opens with the message when you send thanks

---

## Known and expected — not faults

- **A 29 February birthday** shows on 28 Feb in the calendar and 1 Mar in
  reminders. Long-standing, deliberately left alone.
- **Movable festivals show "needs a date".** Correct — the app refuses to guess
  Diwali, because greeting hundreds of people on the wrong day is worse than not
  greeting them.
- **Notifications and SMS do nothing on a laptop.** Android only.

---

## If something fails

Write down: which step, what you expected, what happened. On a laptop, open the
console (F12) and copy the red text — it names the file and line and is worth
more than a screenshot.

**If any visitor data is missing after the upgrade: stop.** Do not add anything,
do not sync. The backup you took at the start is the way back.
