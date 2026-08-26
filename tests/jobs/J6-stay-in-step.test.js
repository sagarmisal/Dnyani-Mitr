// @vitest-environment happy-dom
/**
 * J6 — Keep three NGOs in step, with no server.
 *
 * The devices are not alike. A laptop runs current Chrome; the phones run
 * whatever WebView the OEM last shipped. So every leg is exercised with the
 * CAPABILITIES of each end, not just the data.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import zlib from 'node:zlib';
import TextSync from '../../src/services/TextSyncService.js';

function asDevice({ canCompress = true, canDecompress = true } = {}) {
    const mk = (fn) => class {
        constructor() {
            const chunks = [];
            this.readable = new ReadableStream({ start: (c) => { this._c = c; } });
            this.writable = new WritableStream({
                write: (ch) => chunks.push(ch),
                close: () => {
                    const all = Buffer.concat(chunks.map(c => Buffer.from(c)));
                    this._c.enqueue(new Uint8Array(fn(all)));
                    this._c.close();
                }
            });
        }
    };
    canCompress ? (globalThis.CompressionStream = mk(zlib.gzipSync)) : delete globalThis.CompressionStream;
    canDecompress ? (globalThis.DecompressionStream = mk(zlib.gunzipSync)) : delete globalThis.DecompressionStream;
}
const MODERN = { canCompress: true, canDecompress: true };
const OLD = { canCompress: false, canDecompress: false };

const register = (n) => ({
    metadata: { app: 'NGO_Visitor_Manager', version: '3.3.0', backupType: 'full',
                exportedAt: '2026-08-25T00:00:00.000Z', machineId: 'a', machineRole: 'root' },
    data: {
        visitors: Array.from({ length: n }, (_, i) => ({
            id: 'v' + i, isDeleted: false, status: 'active',
            contacts: [{ relationType: 'SELF', name: i % 2 ? 'सुनीता पाटील ' + i : 'Ramesh ' + i,
                         phones: ['98220' + (10000 + i)], emails: [] }],
            notes: 'जेवण आणि पुस्तके आणतात 🙏'
        })),
        interactions: [{ id: 'i1', visitorId: 'v0', interactionType: 'visit',
            interactionDate: '2025-08-24T12:00:00.000Z', contribution: ['meal'], thankedAt: null }],
        reminderActions: [], occasions: [], campaigns: [], scheduledItems: [],
        settings: { organizationName: 'भगवान बाबा बालिकाश्रम' }, syncLog: [], knownMachines: {}
    }
});

afterEach(() => { delete globalThis.CompressionStream; delete globalThis.DecompressionStream; });

async function leg(from, to, pkg) {
    asDevice(from);
    const out = await TextSync.encode(pkg);
    asDevice(to);
    return TextSync.decode(out.text);
}

describe('J6 · stay in step', () => {
    [['laptop → mobile', MODERN, MODERN],
     ['mobile → mobile', MODERN, MODERN],
     ['mobile → laptop', MODERN, MODERN],
     ['laptop → old phone', MODERN, OLD],
     ['old phone → laptop', OLD, MODERN],
     ['old phone → old phone', OLD, OLD]].forEach(([name, a, b]) => {
        it(name, async () => {
            const r = await leg(a, b, register(50));
            expect(r.pkg.data.visitors).toHaveLength(50);
            expect(r.pkg.data.settings.organizationName).toBe('भगवान बाबा बालिकाश्रम');
        });
    });

    it('a real register fits in a handful of WhatsApp messages', async () => {
        asDevice(MODERN);
        expect((await TextSync.encode(register(300))).chunkCount).toBeLessThanOrEqual(5);
    });

    it('what a phone typed reaches the other phone unchanged', async () => {
        const r = await leg(MODERN, MODERN, register(3));
        expect(r.pkg.data.interactions[0].contribution).toEqual(['meal']);
        expect(r.pkg.data.visitors[1].notes).toContain('🙏');
    });

    it('a corrupted message is refused, never half-imported', async () => {
        asDevice(MODERN);
        const out = await TextSync.encode(register(5));
        const lines = out.text.split('\n');
        lines[1] = lines[1].slice(0, 30) + (lines[1][30] === 'Q' ? 'R' : 'Q') + lines[1].slice(31);
        await expect(TextSync.decode(lines.join('\n'))).rejects.toThrow();
    });
});
