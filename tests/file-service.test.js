// @vitest-environment happy-dom
//
// Iteration 11, Phase F — what CAN be tested about native file handling.
//
// Be clear about the limit: no test here says anything about whether MIUI or
// ColorOS actually honour a share intent. That is verified on the pilot phone
// (E5a) or the feature ships switched off. What these tests DO pin is the
// contract around it: that the app degrades honestly when the plugins are
// absent, never claims a file it did not write, and correctly delivers a file
// that arrives from another app.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import FileService from '../src/services/FileService.js';
import { saveFile, getSyncCapabilities } from '../src/utils/helpers.js';

function fakeCapacitor({ filesystem = true, share = true, native = true } = {}) {
    const calls = { write: [], share: [] };
    const plugins = {};
    if (filesystem) {
        plugins.Filesystem = {
            writeFile: vi.fn(async (opts) => { calls.write.push(opts); return { uri: 'content://cache/' + opts.path }; })
        };
    }
    if (share) {
        plugins.Share = { share: vi.fn(async (opts) => { calls.share.push(opts); return {}; }) };
    }
    window.Capacitor = { isNativePlatform: () => native, Plugins: plugins };
    return calls;
}

afterEach(() => {
    delete window.Capacitor;
    delete window.__dnyaniMitrPendingFile;
    vi.restoreAllMocks();
});

describe('availability', () => {
    it('is unavailable in a plain browser', () => {
        expect(FileService.isAvailable()).toBe(false);
    });

    it('is unavailable on Capacitor when the plugins are missing', () => {
        fakeCapacitor({ filesystem: false, share: false });
        expect(FileService.isAvailable()).toBe(false);
    });

    it('is unavailable when only one of the two plugins is present', () => {
        fakeCapacitor({ share: false });
        expect(FileService.isAvailable()).toBe(false);
    });

    it('is available only with a native platform AND both plugins', () => {
        fakeCapacitor();
        expect(FileService.isAvailable()).toBe(true);
    });
});

describe('shareFile', () => {
    it('writes to CACHE and opens the share sheet with the file URI', async () => {
        const calls = fakeCapacitor();
        const res = await FileService.shareFile('{"a":1}', 'backup.json', 'Dnyani Mitr backup');

        expect(res.ok).toBe(true);
        expect(calls.write[0]).toMatchObject({ path: 'backup.json', directory: 'CACHE', encoding: 'utf8' });
        expect(calls.share[0].url).toBe('content://cache/backup.json');
    });

    it('preserves Devanagari through the write', async () => {
        const calls = fakeCapacitor();
        await FileService.shareFile('{"name":"सुनीता पाटील"}', 'b.json');
        expect(calls.write[0].data).toContain('सुनीता पाटील');
    });

    it('treats a dismissed share sheet as success, not failure', async () => {
        fakeCapacitor();
        window.Capacitor.Plugins.Share.share = vi.fn(async () => { throw new Error('Share canceled'); });
        const res = await FileService.shareFile('x', 'b.json');
        expect(res).toMatchObject({ ok: true, cancelled: true });
    });

    it('reports a real failure instead of swallowing it into a success', async () => {
        fakeCapacitor();
        window.Capacitor.Plugins.Filesystem.writeFile = vi.fn(async () => { throw new Error('No space left'); });
        const res = await FileService.shareFile('x', 'b.json');
        expect(res.ok).toBe(false);
        expect(res.reason).toContain('No space');
    });

    it('refuses cleanly when unavailable, rather than pretending', async () => {
        const res = await FileService.shareFile('x', 'b.json');
        expect(res).toEqual({ ok: false, reason: 'unavailable' });
    });
});

describe('saveToDevice', () => {
    it('writes a keepable copy to DOCUMENTS', async () => {
        const calls = fakeCapacitor();
        const res = await FileService.saveToDevice('{"a":1}', 'backup.json');
        expect(res.ok).toBe(true);
        expect(calls.write[0]).toMatchObject({ directory: 'DOCUMENTS', recursive: true });
    });
});

describe('onFileOpened — a backup tapped in WhatsApp', () => {
    it('delivers a file dispatched while the app is running', () => {
        const seen = [];
        const off = FileService.onFileOpened((content, name) => seen.push({ content, name }));

        window.dispatchEvent(new CustomEvent('dnyanimitr:file', {
            detail: { content: '{"visitors":[]}', name: 'DnyaniMitr_Backup.json' }
        }));

        expect(seen).toHaveLength(1);
        expect(seen[0].name).toBe('DnyaniMitr_Backup.json');
        off();
    });

    it('drains a file that LAUNCHED the app, which arrives before any listener exists', () => {
        window.__dnyaniMitrPendingFile = { content: '{"visitors":[]}', name: 'launched.json' };

        const seen = [];
        const off = FileService.onFileOpened((content, name) => seen.push(name));

        expect(seen).toEqual(['launched.json']);
        expect(window.__dnyaniMitrPendingFile).toBeNull();
        off();
    });

    it('ignores an empty or malformed payload', () => {
        const seen = [];
        const off = FileService.onFileOpened(() => seen.push(1));
        window.dispatchEvent(new CustomEvent('dnyanimitr:file', { detail: { content: '   ' } }));
        window.dispatchEvent(new CustomEvent('dnyanimitr:file', { detail: {} }));
        expect(seen).toHaveLength(0);
        off();
    });

    it('stops delivering after unsubscribe', () => {
        const seen = [];
        const off = FileService.onFileOpened(() => seen.push(1));
        off();
        window.dispatchEvent(new CustomEvent('dnyanimitr:file', { detail: { content: '{}' } }));
        expect(seen).toHaveLength(0);
    });
});

describe('F0 — saveFile never claims a file it did not write', () => {
    it('reports unavailable on Capacitor instead of running a no-op download', async () => {
        fakeCapacitor();
        // navigator.share does not exist in an Android WebView, so the share path
        // is skipped and the anchor download would be a silent no-op.
        expect(getSyncCapabilities().canDownload).toBe(false);

        const res = await saveFile('{"a":1}', 'x.json');
        expect(res.method).toBe('unavailable');
        expect(res.reason).toMatch(/cannot save files/i);
    });

    it('still uses the browser download path on desktop', async () => {
        expect(getSyncCapabilities().canDownload).toBe(true);
        const res = await saveFile('{"a":1}', 'x.json');
        expect(res.method).toBe('download');
    });
});
