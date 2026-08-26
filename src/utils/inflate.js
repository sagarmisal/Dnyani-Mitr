// A gzip reader that works everywhere — INITIATIVE.md J6.
//
// WHY THIS EXISTS
// ---------------
// TextSyncService compresses with CompressionStream when the device has it.
// Decompression used to require DecompressionStream, and when it was missing
// the import threw "Ask the sender to export without compression" — advice the
// user cannot act on, because the sending device decides that and the UI offers
// no such choice. A laptop-to-old-phone transfer simply dead-ended.
//
// The asymmetry is the point. COMPRESSING is optional: a device that cannot
// compress falls back to plain text, and everyone can still read it.
// DECOMPRESSING is not: a device that cannot decompress is locked out of every
// message every modern device sends, and the sender has no way to know.
//
// Sending uncompressed instead is not a fix. Measured on a real register — 300
// visitors in Marathi — compressed is 2 WhatsApp messages and uncompressed is
// about 51. Nobody is forwarding 51 messages.
//
// So: ~180 lines of DEFLATE, used only as a fallback. It is a fixed, forty-year
// old format with no ambiguity, and the tests fuzz it against Node's own zlib
// on random and adversarial inputs rather than trusting a reading of the spec.
//
// RFC 1951 (DEFLATE) and RFC 1952 (gzip container).

const LENGTH_BASE = [
    3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31,
    35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258
];
const LENGTH_EXTRA = [
    0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2,
    3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0
];
const DIST_BASE = [
    1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193,
    257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577
];
const DIST_EXTRA = [
    0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6,
    7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13
];
// The order code lengths are themselves written in — RFC 1951 §3.2.7.
const CLEN_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

/** Canonical Huffman decoding table built from code lengths alone. */
function buildTree(lengths) {
    const maxBits = Math.max(...lengths, 0);
    const blCount = new Array(maxBits + 1).fill(0);
    lengths.forEach(l => { if (l) blCount[l]++; });

    const nextCode = new Array(maxBits + 1).fill(0);
    let code = 0;
    for (let bits = 1; bits <= maxBits; bits++) {
        code = (code + blCount[bits - 1]) << 1;
        nextCode[bits] = code;
    }

    const map = new Map();
    lengths.forEach((len, symbol) => {
        if (!len) return;
        map.set(`${len}:${nextCode[len]++}`, symbol);
    });
    return { map, maxBits };
}

class BitReader {
    constructor(bytes) {
        this.bytes = bytes;
        this.pos = 0;
        this.bit = 0;
    }
    /** DEFLATE packs bits LSB-first within each byte. */
    readBit() {
        if (this.pos >= this.bytes.length) throw new Error('Compressed data ended unexpectedly');
        const b = (this.bytes[this.pos] >> this.bit) & 1;
        if (++this.bit === 8) { this.bit = 0; this.pos++; }
        return b;
    }
    readBits(n) {
        let v = 0;
        for (let i = 0; i < n; i++) v |= this.readBit() << i;
        return v;
    }
    alignToByte() {
        if (this.bit) { this.bit = 0; this.pos++; }
    }
    /** Huffman codes are packed MSB-first, unlike everything else. */
    readSymbol(tree) {
        let code = 0;
        for (let len = 1; len <= tree.maxBits; len++) {
            code = (code << 1) | this.readBit();
            const sym = tree.map.get(`${len}:${code}`);
            if (sym !== undefined) return sym;
        }
        throw new Error('Invalid compressed data (no matching Huffman code)');
    }
}

let FIXED_LIT = null;
let FIXED_DIST = null;
function fixedTrees() {
    if (!FIXED_LIT) {
        const lit = new Array(288);
        for (let i = 0; i < 144; i++) lit[i] = 8;
        for (let i = 144; i < 256; i++) lit[i] = 9;
        for (let i = 256; i < 280; i++) lit[i] = 7;
        for (let i = 280; i < 288; i++) lit[i] = 8;
        FIXED_LIT = buildTree(lit);
        FIXED_DIST = buildTree(new Array(30).fill(5));
    }
    return [FIXED_LIT, FIXED_DIST];
}

function readDynamicTrees(br) {
    const hlit = br.readBits(5) + 257;
    const hdist = br.readBits(5) + 1;
    const hclen = br.readBits(4) + 4;

    const clens = new Array(19).fill(0);
    for (let i = 0; i < hclen; i++) clens[CLEN_ORDER[i]] = br.readBits(3);
    const clTree = buildTree(clens);

    // The literal and distance lengths share one run-length encoded stream.
    const lengths = [];
    while (lengths.length < hlit + hdist) {
        const sym = br.readSymbol(clTree);
        if (sym < 16) { lengths.push(sym); continue; }
        if (sym === 16) {
            const prev = lengths[lengths.length - 1];
            if (prev === undefined) throw new Error('Invalid compressed data (repeat with no previous length)');
            const n = 3 + br.readBits(2);
            for (let i = 0; i < n; i++) lengths.push(prev);
        } else if (sym === 17) {
            const n = 3 + br.readBits(3);
            for (let i = 0; i < n; i++) lengths.push(0);
        } else {
            const n = 11 + br.readBits(7);
            for (let i = 0; i < n; i++) lengths.push(0);
        }
    }
    return [buildTree(lengths.slice(0, hlit)), buildTree(lengths.slice(hlit, hlit + hdist))];
}

/** Raw DEFLATE (RFC 1951). */
export function inflateRaw(bytes) {
    const br = new BitReader(bytes);
    const out = [];

    for (;;) {
        const final = br.readBit();
        const type = br.readBits(2);

        if (type === 0) {
            // Stored: byte-aligned, with a length and its complement.
            br.alignToByte();
            const len = br.bytes[br.pos] | (br.bytes[br.pos + 1] << 8);
            const nlen = br.bytes[br.pos + 2] | (br.bytes[br.pos + 3] << 8);
            if ((len ^ 0xFFFF) !== nlen) throw new Error('Invalid compressed data (stored block length mismatch)');
            br.pos += 4;
            for (let i = 0; i < len; i++) out.push(br.bytes[br.pos++]);
        } else if (type === 1 || type === 2) {
            const [litTree, distTree] = type === 1 ? fixedTrees() : readDynamicTrees(br);
            for (;;) {
                const sym = br.readSymbol(litTree);
                if (sym === 256) break;
                if (sym < 256) { out.push(sym); continue; }

                const li = sym - 257;
                if (li >= LENGTH_BASE.length) throw new Error('Invalid compressed data (length code out of range)');
                const length = LENGTH_BASE[li] + br.readBits(LENGTH_EXTRA[li]);

                const di = br.readSymbol(distTree);
                if (di >= DIST_BASE.length) throw new Error('Invalid compressed data (distance code out of range)');
                const dist = DIST_BASE[di] + br.readBits(DIST_EXTRA[di]);
                if (dist > out.length) throw new Error('Invalid compressed data (back-reference before start)');

                // Overlapping copies are legal and common — copy one byte at a
                // time so a run longer than the distance repeats correctly.
                const start = out.length - dist;
                for (let i = 0; i < length; i++) out.push(out[start + i]);
            }
        } else {
            throw new Error('Invalid compressed data (reserved block type)');
        }

        if (final) break;
    }
    return new Uint8Array(out);
}

/** gzip container (RFC 1952) wrapping a DEFLATE stream. */
export function gunzip(bytes) {
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (b.length < 18 || b[0] !== 0x1f || b[1] !== 0x8b) {
        throw new Error('Not a gzip stream');
    }
    if (b[2] !== 8) throw new Error('Unsupported gzip compression method');

    const flags = b[3];
    let p = 10;                                  // magic, method, flags, mtime, xfl, os
    if (flags & 0x04) { p += 2 + (b[p] | (b[p + 1] << 8)); }   // FEXTRA
    if (flags & 0x08) { while (b[p++]) { /* FNAME */ } }
    if (flags & 0x10) { while (b[p++]) { /* FCOMMENT */ } }
    if (flags & 0x02) { p += 2; }                              // FHCRC

    // The trailer is CRC32 + ISIZE. We do not verify the CRC here: the chunked
    // transport already carries its own checksum over the whole base64 payload
    // and refuses a corrupted paste before we ever get here.
    return inflateRaw(b.subarray(p, b.length - 8));
}

/** Decode a gzip stream straight to a string. */
export function gunzipToString(bytes) {
    return new TextDecoder().decode(gunzip(bytes));
}

export default { inflateRaw, gunzip, gunzipToString };
