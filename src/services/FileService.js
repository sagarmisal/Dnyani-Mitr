// FileService (Iter 11, Phase F) — saving and sharing a real file on Android.
//
// The team believed "files don't work on mobile". They do. `saveFile()` was
// broken: Android WebView implements no Web Share API, `@capacitor/share` was
// never installed, MainActivity registered no DownloadListener, and a blob: URL
// cannot reach Android's DownloadManager — so all three of its paths were
// no-ops, and it reported success anyway (F-DEFECT-0, fixed by F0).
//
// The plugins are reached through `window.Capacitor.Plugins` at RUNTIME, the
// same pattern SmsService and NotificationService already use. Nothing is
// statically imported, so the web bundle and the single-file `file://` desktop
// build are completely unaffected and the zero-new-dependency rule for the
// browser build survives.
//
// The file travels as a `content://` URI through the FileProvider Capacitor has
// already configured (`file_paths.xml` covers cache-path). That is precisely
// what MIUI and ColorOS do NOT break — raw external-storage writes are what
// they break.
//
// GOVERNING RULE: the text route stays the guaranteed path. Everything here is
// additive. If it fails on a device, `FEATURES.nativeFiles` is switched off and
// the app behaves exactly as it does today.

import { FEATURES } from '../utils/constants.js';

class FileService {
    static _plugins() {
        if (typeof window === 'undefined' || !window.Capacitor || !window.Capacitor.Plugins) return null;
        return window.Capacitor.Plugins;
    }

    static _isNative() {
        return !!(typeof window !== 'undefined'
            && window.Capacitor
            && typeof window.Capacitor.isNativePlatform === 'function'
            && window.Capacitor.isNativePlatform());
    }

    /** True only when a real file can actually be produced AND shared. */
    static isAvailable() {
        if (!FEATURES.nativeFiles) return false;
        const p = this._plugins();
        return !!(this._isNative() && p && p.Filesystem && p.Share);
    }

    /**
     * Write to the app cache and open the system share sheet.
     * Cache, not Documents: the file is a courier, not an archive, and Android
     * reclaims it. Use saveToDevice() for a copy the volunteer keeps.
     */
    static async shareFile(content, filename, title = 'Dnyani Mitr') {
        if (!this.isAvailable()) {
            return { ok: false, reason: 'unavailable' };
        }
        const { Filesystem, Share } = this._plugins();
        try {
            const written = await Filesystem.writeFile({
                path: filename,
                data: content,
                directory: 'CACHE',
                encoding: 'utf8'
            });
            await Share.share({
                title,
                text: title,
                url: written.uri,
                dialogTitle: 'Send with'
            });
            return { ok: true, uri: written.uri, method: 'share' };
        } catch (err) {
            // A dismissed share sheet is not a failure; anything else is, and is
            // reported honestly rather than swallowed into a success message.
            const message = String(err?.message || err);
            if (/cancel/i.test(message)) return { ok: true, cancelled: true, method: 'share' };
            return { ok: false, reason: message };
        }
    }

    /**
     * F2 — a copy in Documents that survives the share sheet, so a backup exists
     * somewhere the volunteer can find later without depending on WhatsApp.
     */
    static async saveToDevice(content, filename) {
        if (!this.isAvailable()) {
            return { ok: false, reason: 'unavailable' };
        }
        const { Filesystem } = this._plugins();
        try {
            const written = await Filesystem.writeFile({
                path: filename,
                data: content,
                directory: 'DOCUMENTS',
                encoding: 'utf8',
                recursive: true
            });
            return { ok: true, uri: written.uri, method: 'saved' };
        } catch (err) {
            return { ok: false, reason: String(err?.message || err) };
        }
    }

    /**
     * F3 — a backup handed to the app by tapping it in WhatsApp.
     *
     * MainActivity forwards ACTION_VIEW / ACTION_SEND payloads to the web layer
     * as a `dnyanimitr:file` window event. Tap the attachment in the chat, pick
     * Dnyani Mitr, and it imports: no picker, no folder hunting, no
     * scoped-storage archaeology. This is what makes files EASIER than pasting
     * text rather than merely possible.
     *
     * @param {(text: string, name: string) => void} handler
     * @returns {() => void} unsubscribe
     */
    static onFileOpened(handler) {
        if (typeof window === 'undefined') return () => {};
        const listener = (event) => {
            const detail = event?.detail || {};
            if (typeof detail.content === 'string' && detail.content.trim()) {
                handler(detail.content, detail.name || 'shared-file.json');
            }
        };
        window.addEventListener('dnyanimitr:file', listener);

        // A file that launched the app arrives before any listener exists, so
        // MainActivity parks it here and we drain it on subscribe.
        if (window.__dnyaniMitrPendingFile) {
            const pending = window.__dnyaniMitrPendingFile;
            window.__dnyaniMitrPendingFile = null;
            try { handler(pending.content, pending.name || 'shared-file.json'); } catch (e) {
                console.error('FileService: pending file handler failed', e);
            }
        }

        return () => window.removeEventListener('dnyanimitr:file', listener);
    }
}

export default FileService;
