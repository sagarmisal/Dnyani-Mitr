// @vitest-environment happy-dom
/**
 * The flow the whole app rests on: laptop → mobile, mobile → mobile,
 * mobile → laptop. If any leg fails, the NGOs cannot share a register at all
 * and everything else we built is decoration.
 *
 * The devices are NOT identical. A laptop runs current Chrome; the phones run
 * whatever WebView the OEM last shipped, and MI/Oppo devices are routinely
 * years behind. So each leg is tested with the CAPABILITIES of the two ends,
 * not just the data.
 *
 * The asymmetry that matters: compressing is optional — a sender without
 * CompressionStream can fall back to plain text. Decompressing is NOT. If a
 * device cannot read a compressed message, that message is simply lost to it,
 * and the sender has no way to know or to help.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import zlib from 'node:zlib';
import TextSync from '../src/services/TextSyncService.js';

/** Stand in for a device by turning its compression capability on or off. */
function asDevice({ canCompress = true, canDecompress = true } = {}) {
    if (canCompress) {
        globalThis.CompressionStream = class {
            constructor() {
                const chunks = [];
                this.readable = new ReadableStream({
                    start: (c) => { this._c = c; }
                });
                this.writable = new WritableStream({
                    write: (chunk) => chunks.push(chunk),
                    close: () => {
                        const all = Buffer.concat(chunks.map(c => Buffer.from(c)));
                        this._c.enqueue(new Uint8Array(zlib.gzipSync(all)));
                        this._c.close();
                    }
                });
            }
        };
    } else {
        delete globalThis.CompressionStream;
    }

    if (canDecompress) {
        globalThis.DecompressionStream = class {
            constructor() {
                const chunks = [];
                this.readable = new ReadableStream({ start: (c) => { this._c = c; } });
                this.writable = new WritableStream({
                    write: (chunk) => chunks.push(chunk),
                    close: () => {
                        const all = Buffer.concat(chunks.map(c => Buffer.from(c)));
                        this._c.enqueue(new Uint8Array(zlib.gunzipSync(all)));
                        this._c.close();
                    }
                });
            }
        };
    } else {
        delete globalThis.DecompressionStream;
    }
}

const MODERN = { canCompress: true, canDecompress: true };    // laptop, current phone
const ANCIENT = { canCompress: false, canDecompress: false }; // stale OEM WebView

/** A register with the things most likely to break in transit. */
function register(n = 40) {
    return {
        metadata: {
            app: 'NGO_Visitor_Manager', version: '3.3.0', backupType: 'full',
            exportedAt: '2026-08-25T00:00:00.000Z', machineId: 'm_a', machineRole: 'root'
        },
        data: {
            visitors: Array.from({ length: n }, (_, i) => ({
                id: 'visitor_' + i,
                contacts: [{
                    relationType: 'SELF',
                    name: i % 3 ? 'सुनीता पाटील ' + i : 'Ramesh Jadhav ' + i,
                    phones: ['98220' + String(10000 + i)],
                    emails: [], customEvents: []
                }],
                notes: 'दरवर्षी मुलीच्या वाढदिवसाला भेट देतात. 🙏',
                isDeleted: false
            })),
            interactions: [{
                id: 'i1', visitorId: 'visitor_0', interactionType: 'visit',
                interactionDate: '2025-08-24T12:00:00.000Z',
                notes: 'जेवण दिलं — "खूप छान" म्हणाले', contribution: ['meal'], thankedAt: null
            }],
            reminderActions: [], occasions: [], campaigns: [], scheduledItems: [],
            settings: { organizationName: 'भगवान बाबा बालिकाश्रम' },
            syncLog: [], knownMachines: {}
        }
    };
}

afterEach(() => {
    delete globalThis.CompressionStream;
    delete globalThis.DecompressionStream;
});

/** Encode on one device, decode on another. */
async function transfer(sender, receiver, pkg) {
    asDevice(sender);
    const out = await TextSync.encode(pkg);
    asDevice(receiver);
    return { out, result: await TextSync.decode(out.text) };
}

describe('every leg of the flow, between devices that are not alike', () => {
    const legs = [
        ['laptop → mobile', MODERN, MODERN],
        ['mobile → mobile', MODERN, MODERN],
        ['mobile → laptop', MODERN, MODERN],
        ['old phone → laptop  (sender cannot compress)', ANCIENT, MODERN],
        ['laptop → old phone  (receiver cannot decompress)', MODERN, ANCIENT],
        ['old phone → old phone', ANCIENT, ANCIENT]
    ];

    legs.forEach(([name, from, to]) => {
        it(name, async () => {
            const pkg = register();
            const { result } = await transfer(from, to, pkg);
            expect(result.pkg.data.visitors).toHaveLength(40);
            expect(result.pkg.data.settings.organizationName).toBe('भगवान बाबा बालिकाश्रम');
        });
    });
});

describe('what survives the journey', () => {
    beforeEach(() => asDevice(MODERN));

    it('Devanagari, emoji and quotes come through byte for byte', async () => {
        const pkg = register(5);
        const { result } = await transfer(MODERN, MODERN, pkg);
        const i = result.pkg.data.interactions[0];
        expect(i.notes).toBe('जेवण दिलं — "खूप छान" म्हणाले');
        expect(result.pkg.data.visitors[0].notes).toContain('🙏');
    });

    it('the new Phase 2 fields survive', async () => {
        const { result } = await transfer(MODERN, MODERN, register(3));
        const i = result.pkg.data.interactions[0];
        expect(i.contribution).toEqual(['meal']);
        expect(i.thankedAt).toBeNull();
    });

    it('a real register still fits in a handful of WhatsApp messages', async () => {
        asDevice(MODERN);
        const out = await TextSync.encode(register(300));
        expect(out.chunkCount).toBeLessThanOrEqual(5);
    });
});

describe('the ways a WhatsApp paste goes wrong', () => {
    beforeEach(() => asDevice(MODERN));

    it('refuses a paste missing one of several messages, naming which', async () => {
        const out = await TextSync.encode(register(300));
        expect(out.chunkCount).toBeGreaterThan(1);
        const only1 = out.text.split('====DM-SYNC').slice(0, 2).join('====DM-SYNC');
        await expect(TextSync.decode(only1)).rejects.toThrow(/[Mm]issing/);
    });

    it('refuses a corrupted paste rather than importing wrong data', async () => {
        const out = await TextSync.encode(register(5));
        const lines = out.text.split('\n');
        lines[1] = lines[1].slice(0, 40) + (lines[1][40] === 'Q' ? 'R' : 'Q') + lines[1].slice(41);
        await expect(TextSync.decode(lines.join('\n'))).rejects.toThrow();
    });

    it('tolerates the junk WhatsApp adds around a forwarded message', async () => {
        const out = await TextSync.encode(register(5));
        const messy = `[25/08/26, 2:14 pm] Sunita: here you go 🙏\n${out.text}\n\nsent from my phone`;
        const result = await TextSync.decode(messy);
        expect(result.pkg.data.visitors).toHaveLength(5);
    });

    it('refuses plain text that is not a backup at all', async () => {
        await expect(TextSync.decode('hello, are you free tomorrow?')).rejects.toThrow();
        await expect(TextSync.decode('')).rejects.toThrow();
    });
});

describe('the receiving device can always read a compressed message', () => {
    it('reads it with no DecompressionStream at all', async () => {
        asDevice({ canCompress: true, canDecompress: false });
        const pkg = register(120);
        asDevice({ canCompress: true, canDecompress: true });
        const out = await TextSync.encode(pkg);          // a modern sender compresses
        asDevice({ canCompress: false, canDecompress: false });   // an old phone receives
        const result = await TextSync.decode(out.text);
        expect(result.pkg.data.visitors).toHaveLength(120);
        expect(result.pkg.data.visitors[1].name || result.pkg.data.visitors[1].contacts[0].name)
            .toContain('सुनीता');
    });

    it('reads it when the API exists but throws — what OEM WebViews actually do', async () => {
        asDevice({ canCompress: true, canDecompress: true });
        const out = await TextSync.encode(register(30));

        // Present, and broken. This is the nastier case: feature detection says
        // yes and the call fails, so a guard on `typeof` alone is not enough.
        globalThis.DecompressionStream = class {
            constructor() { throw new Error('not really implemented'); }
        };
        const result = await TextSync.decode(out.text);
        expect(result.pkg.data.visitors).toHaveLength(30);
    });

    it('still refuses a corrupted message rather than half-reading it', async () => {
        asDevice({ canCompress: true, canDecompress: true });
        const out = await TextSync.encode(register(20));
        asDevice({ canCompress: false, canDecompress: false });
        const lines = out.text.split('\n');
        lines[1] = lines[1].slice(0, 30) + (lines[1][30] === 'Q' ? 'R' : 'Q') + lines[1].slice(31);
        await expect(TextSync.decode(lines.join('\n'))).rejects.toThrow();
    });
});
