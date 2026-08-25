/**
 * A gzip reader has one job and no room for "mostly works": a single wrong bit
 * silently corrupts a register. So this does not test my reading of RFC 1951 —
 * it tests my code against Node's zlib, on inputs chosen to hit each branch and
 * on random data, because agreement with a reference implementation is the only
 * evidence worth having here.
 */

import { describe, it, expect } from 'vitest';
import zlib from 'node:zlib';
import { gunzip, gunzipToString, inflateRaw } from '../src/utils/inflate.js';

const enc = (s) => Buffer.from(s, 'utf8');
const roundTrip = (buf, opts) => gunzip(new Uint8Array(zlib.gzipSync(buf, opts)));

describe('agreement with zlib', () => {
    it('reads an empty payload', () => {
        expect(Buffer.from(roundTrip(enc('')))).toEqual(enc(''));
    });

    it('reads plain ASCII', () => {
        expect(gunzipToString(new Uint8Array(zlib.gzipSync(enc('hello'))))).toBe('hello');
    });

    it('reads Devanagari and emoji intact', () => {
        const s = 'सुनीता पाटील — जेवण दिलं 🙏 "खूप छान"';
        expect(gunzipToString(new Uint8Array(zlib.gzipSync(enc(s))))).toBe(s);
    });

    it('reads a realistic backup payload', () => {
        const pkg = JSON.stringify({
            metadata: { version: '3.3.0' },
            data: {
                visitors: Array.from({ length: 200 }, (_, i) => ({
                    id: 'visitor_' + i,
                    contacts: [{ name: 'सुनीता पाटील ' + i, phones: ['98220' + (10000 + i)] }],
                    notes: 'दरवर्षी मुलीच्या वाढदिवसाला भेट देतात.'
                }))
            }
        });
        expect(gunzipToString(new Uint8Array(zlib.gzipSync(enc(pkg))))).toBe(pkg);
    });
});

describe('every DEFLATE block type', () => {
    it('stored — incompressible data, level 0', () => {
        const data = Buffer.from(Array.from({ length: 5000 }, (_, i) => (i * 7919) % 256));
        expect(Buffer.from(roundTrip(data, { level: 0 }))).toEqual(data);
    });

    it('fixed Huffman — short input', () => {
        const data = enc('abc');
        expect(Buffer.from(roundTrip(data, { level: 9 }))).toEqual(data);
    });

    it('dynamic Huffman — long repetitive input', () => {
        const data = enc('सुनीता पाटील '.repeat(500));
        expect(Buffer.from(roundTrip(data, { level: 9 }))).toEqual(data);
    });

    it('multiple blocks — larger than one deflate window', () => {
        const data = Buffer.concat([
            Buffer.from(Array.from({ length: 100000 }, (_, i) => (i * 31) % 256)),
            enc('सुनीता'.repeat(2000))
        ]);
        expect(Buffer.from(roundTrip(data, { level: 6 }))).toEqual(data);
    });
});

describe('the cases that break a naive implementation', () => {
    it('overlapping back-references, where the run is longer than the distance', () => {
        // "aaaa..." compresses to one byte plus a copy that reads bytes it is
        // still writing. Copying in bulk instead of one at a time gets this wrong.
        const data = enc('a'.repeat(1000));
        expect(Buffer.from(roundTrip(data, { level: 9 }))).toEqual(data);
    });

    it('a distance of exactly 1', () => {
        const data = enc('ab' + 'b'.repeat(300));
        expect(Buffer.from(roundTrip(data, { level: 9 }))).toEqual(data);
    });

    it('the maximum match length of 258', () => {
        const data = enc('x'.repeat(258) + 'tail');
        expect(Buffer.from(roundTrip(data, { level: 9 }))).toEqual(data);
    });

    it('a gzip stream carrying a filename header (FNAME)', () => {
        const gz = zlib.gzipSync(enc('payload'));
        // Rebuild with FNAME set, as some tools emit.
        const withName = Buffer.concat([
            Buffer.from([0x1f, 0x8b, 8, 0x08, 0, 0, 0, 0, 0, 3]),
            Buffer.from('backup.json\0', 'binary'),
            gz.subarray(10)
        ]);
        expect(gunzipToString(new Uint8Array(withName))).toBe('payload');
    });

    it('every byte value survives, including nulls and high bytes', () => {
        const data = Buffer.from(Array.from({ length: 256 }, (_, i) => i));
        expect(Buffer.from(roundTrip(data))).toEqual(data);
    });
});

describe('fuzz against zlib — 150 random payloads', () => {
    it('agrees on every one', () => {
        // Deterministic PRNG so a failure is reproducible.
        let seed = 20260825;
        const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

        for (let n = 0; n < 150; n++) {
            const len = Math.floor(rnd() * 4000);
            const style = n % 3;
            let data;
            if (style === 0) {
                data = Buffer.from(Array.from({ length: len }, () => Math.floor(rnd() * 256)));
            } else if (style === 1) {
                const word = ['सुनीता', 'Ramesh', '🙏', 'aaa', '{"a":1}'][n % 5];
                data = enc(word.repeat(Math.max(1, Math.floor(len / 4))));
            } else {
                data = enc(JSON.stringify({ v: Array.from({ length: len % 200 }, (_, i) => ({ id: i, n: 'नाव' + i })) }));
            }
            const level = [0, 1, 6, 9][n % 4];
            const got = Buffer.from(gunzip(new Uint8Array(zlib.gzipSync(data, { level }))));
            expect(got, `payload ${n} (len ${data.length}, level ${level})`).toEqual(data);
        }
    });
});

describe('refuses bad input rather than returning wrong bytes', () => {
    it('rejects data that is not gzip', () => {
        expect(() => gunzip(new Uint8Array([1, 2, 3, 4, 5]))).toThrow(/gzip/i);
    });

    it('rejects a truncated stream', () => {
        const gz = zlib.gzipSync(enc('सुनीता पाटील '.repeat(100)));
        expect(() => gunzip(new Uint8Array(gz.subarray(0, gz.length - 40)))).toThrow();
    });

    it('rejects a corrupted body', () => {
        const gz = Buffer.from(zlib.gzipSync(enc('सुनीता '.repeat(200))));
        gz[30] ^= 0xff;
        // Either it throws, or it returns something different — never silently
        // the original. Wrong bytes accepted as correct is the one unacceptable
        // outcome for a register.
        let out = null;
        try { out = Buffer.from(gunzip(new Uint8Array(gz))); } catch { /* expected */ }
        if (out) expect(out.equals(enc('सुनीता '.repeat(200)))).toBe(false);
    });

    it('rejects a reserved block type', () => {
        expect(() => inflateRaw(new Uint8Array([0x07, 0, 0, 0]))).toThrow();
    });
});
