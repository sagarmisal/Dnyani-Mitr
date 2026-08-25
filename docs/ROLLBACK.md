# If v3.3.0 has to be undone

Read this before it is needed. It is short, and the important part is that the
obvious plan does not work.

## The obvious plan does not work

**You cannot install v3.2.0 over v3.3.0.**

v3.3.0 is `versionCode 12`; v3.2.0 is `11`. Android refuses to install an older
versionCode over a newer one. The only way through is to uninstall first — and
uninstalling erases the app's storage, which **is** the register.

So there is no such thing as rolling back the app without losing the data,
regardless of which APKs are kept. Keeping an old APK on hand is not a rollback
plan; it is a trap that looks like one.

## The rollback that does work

**The backup is the rollback.** The data is the thing worth recovering; the app
version is not.

1. **Before the upgrade**, take a text backup and send it somewhere it will
   survive — WhatsApp to yourself is enough. This is the whole plan.
2. If v3.3.0 misbehaves, the register is intact in that message.
3. Fix forward: we ship v3.3.1 with the defect corrected, it installs over 3.3.0
   normally, and nothing is lost.

The upgrade path is one-way. That is not a flaw to be fixed — it is why the app
asks for a backup, and why the card by the phone says the same thing.

## What is kept, and where

    ~/dnyani-releases/DnyaniMitr_v3.3.0.apk     the release
    ~/dnyani-releases/DnyaniMitr_v3.3.0.html    the laptop build

Every release is added here rather than overwritten, so it is always possible to
tell which build a device is running by comparing checksums.

The signing key that makes any of this installable lives at
`~/.android/debug.keystore`, SHA-1 `70:E9:6A:21:…`. **It is the only thing that
can upgrade the phones already carrying this app.** Losing it means every device
must be uninstalled — destroying its register — to take any future release.
Verify it before distributing anything:

    ./scripts/verify-apk.sh        # must print "Signature matches"

## If a device is already broken

Do not uninstall. Tell us what the screen says.

If the app opens at all, take a backup first, even a partial one. If it does not
open, the last backup that was sent on WhatsApp is what the register is now, and
that is the argument for taking one every week.
