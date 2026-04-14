import { describe, it, expect } from 'vitest';
import TextSyncService from '../src/services/TextSyncService.js';

// Sample sync package shaped like SyncService.prepareExport output
function makePackage(visitorCount = 5, withInteractions = true) {
    const visitors = [];
    const interactions = [];
    for (let i = 0; i < visitorCount; i++) {
        const id = `visitor_${i}_${Math.random().toString(36).slice(2, 8)}`;
        visitors.push({
            id,
            category: 'Regular',
            tags: ['test'],
            status: 'active',
            city: 'Pune',
            notes: `Notes for visitor ${i} — includes कुछ unicode characters ॐ`,
            contacts: [
                {
                    id: `c_${i}`,
                    visitorId: id,
                    relationType: 'SELF',
                    name: `Visitor नाव ${i}`,
                    phones: [`98765432${String(i).padStart(2, '0')}`],
                    emails: [`visitor${i}@example.org`],
                    dob: '1990-01-15'
                }
            ],
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-04-01T00:00:00.000Z',
            consentGiven: true,
            consentDate: '2026-01-01T00:00:00.000Z',
            doNotContact: false
        });
        if (withInteractions) {
            for (let j = 0; j < 3; j++) {
                interactions.push({
                    id: `int_${i}_${j}`,
                    visitorId: id,
                    interactionType: 'call',
                    interactionDate: '2026-03-15',
                    notes: `Interaction ${j} for visitor ${i}`,
                    outcome: 'successful',
                    createdBy: 'machine_test',
                    createdAt: '2026-03-15T00:00:00.000Z'
                });
            }
        }
    }
    return {
        metadata: {
            app: 'NGO_Visitor_Manager',
            version: '3.0.0',
            dataVersion: '3.0.0',
            exportedAt: '2026-04-14T00:00:00.000Z',
            machineId: 'machine_test',
            machineName: 'Test Machine',
            machineRole: 'root'
        },
        data: { visitors, interactions }
    };
}

describe('TextSyncService encode/decode roundtrip', () => {
    it('encodes and decodes a small package correctly', async () => {
        const pkg = makePackage(3);
        const { text, chunkCount } = await TextSyncService.encode(pkg);

        expect(text).toContain('====DM-SYNC v1');
        expect(text).toContain('====END');
        expect(chunkCount).toBeGreaterThanOrEqual(1);

        const { pkg: decoded } = await TextSyncService.decode(text);

        expect(decoded.metadata.machineId).toBe('machine_test');
        expect(decoded.data.visitors).toHaveLength(3);
        expect(decoded.data.interactions).toHaveLength(9);
        // Unicode preserved
        expect(decoded.data.visitors[0].contacts[0].name).toContain('नाव');
    });

    it('chunks large payloads into multiple pieces', async () => {
        const pkg = makePackage(100); // bigger — should produce multiple chunks
        const { text, chunkCount, sizeChars } = await TextSyncService.encode(pkg);

        expect(chunkCount).toBeGreaterThan(1);
        // Each chunk's body must be within the limit (roughly)
        const matches = text.match(/====DM-SYNC v1 \d+\/\d+/g);
        expect(matches.length).toBe(chunkCount);

        const { pkg: decoded } = await TextSyncService.decode(text);
        expect(decoded.data.visitors).toHaveLength(100);
    });

    it('detects corrupted checksum', async () => {
        const pkg = makePackage(2);
        const { text } = await TextSyncService.encode(pkg);

        // Corrupt the payload (not the header): flip a char in the middle of the base64 chunk
        const lines = text.split('\n');
        const payloadLineIdx = lines.findIndex((l, i) =>
            !l.startsWith('====') && l.length > 10 && i > 0 && lines[i - 1].startsWith('====DM-SYNC')
        );
        // Flip a character — change 'A' to 'B' or vice versa, must be valid base64
        const original = lines[payloadLineIdx];
        const midIdx = Math.floor(original.length / 2);
        const flipped = original[midIdx] === 'A' ? 'B' : 'A';
        lines[payloadLineIdx] = original.slice(0, midIdx) + flipped + original.slice(midIdx + 1);
        const corrupted = lines.join('\n');

        await expect(TextSyncService.decode(corrupted)).rejects.toThrow(/integrity|corrupt/i);
    });

    it('detects missing chunks', async () => {
        const pkg = makePackage(200); // force multiple chunks even after gzip
        const { text, chunkCount } = await TextSyncService.encode(pkg);
        expect(chunkCount).toBeGreaterThanOrEqual(2);

        // Remove the last chunk
        const lastNum = chunkCount;
        const lastRegex = new RegExp(`====DM-SYNC v1 ${lastNum}\\/\\d+[\\s\\S]*?====END ${lastNum}\\/\\d+====`);
        const stripped = text.replace(lastRegex, '');

        await expect(TextSyncService.decode(stripped)).rejects.toThrow(/missing|chunk/i);
    });

    it('rejects empty input', async () => {
        await expect(TextSyncService.decode('')).rejects.toThrow();
        await expect(TextSyncService.decode('   ')).rejects.toThrow();
    });

    it('rejects text without DM-SYNC markers', async () => {
        await expect(TextSyncService.decode('hello world, nothing to see')).rejects.toThrow(/sync data/i);
    });

    it('tolerates WhatsApp-like noise around chunks', async () => {
        const pkg = makePackage(2);
        const { text } = await TextSyncService.encode(pkg);

        // Wrap the blob with fake WhatsApp metadata
        const noisy = `[14/04/2026, 10:32] Priya: Here's the latest sync —\n\n${text}\n\n[14/04/2026, 10:33] Priya: Let me know if it imports OK\n`;

        const { pkg: decoded } = await TextSyncService.decode(noisy);
        expect(decoded.data.visitors).toHaveLength(2);
    });

    it('ignores chunks from a different export when mixed in', async () => {
        const pkg1 = makePackage(2);
        const pkg2 = makePackage(5);
        const { text: t1 } = await TextSyncService.encode(pkg1);
        const { text: t2 } = await TextSyncService.encode(pkg2);

        // User accidentally pastes both — parser should use the first, ignore the second
        const mixed = t1 + '\n\n' + t2;
        const { pkg: decoded } = await TextSyncService.decode(mixed);

        // Should match one of the two — whichever came first in parsing order
        expect([2, 5]).toContain(decoded.data.visitors.length);
    });
});

describe('TextSyncService.inspect', () => {
    it('reports empty', () => {
        expect(TextSyncService.inspect('').status).toBe('empty');
        expect(TextSyncService.inspect('   ').status).toBe('empty');
    });

    it('reports invalid when no markers found', () => {
        expect(TextSyncService.inspect('hello world').status).toBe('invalid');
    });

    it('reports partial when chunks missing', async () => {
        const pkg = makePackage(200);
        const { text, chunkCount } = await TextSyncService.encode(pkg);
        expect(chunkCount).toBeGreaterThanOrEqual(2);

        // Take only the first chunk
        const firstChunkMatch = text.match(/====DM-SYNC v1 1\/\d+[\s\S]*?====END 1\/\d+====/);
        const onlyFirst = firstChunkMatch[0];

        const report = TextSyncService.inspect(onlyFirst);
        expect(report.status).toBe('partial');
        expect(report.received).toBe(1);
        expect(report.total).toBe(chunkCount);
        expect(report.missing.length).toBe(chunkCount - 1);
    });

    it('reports complete when all chunks present', async () => {
        const pkg = makePackage(3);
        const { text } = await TextSyncService.encode(pkg);
        const report = TextSyncService.inspect(text);
        expect(report.status).toBe('complete');
    });
});

describe('CRC32', () => {
    it('produces stable 8-char hex', () => {
        expect(TextSyncService._crc32('hello')).toMatch(/^[0-9a-f]{8}$/);
    });

    it('differs for different inputs', () => {
        expect(TextSyncService._crc32('hello')).not.toBe(TextSyncService._crc32('world'));
    });

    it('handles UTF-8 (Marathi) correctly', () => {
        // Should not throw; should be deterministic
        const a = TextSyncService._crc32('नमस्कार');
        const b = TextSyncService._crc32('नमस्कार');
        expect(a).toBe(b);
    });
});
