// Text Sync Service — WhatsApp-native copy/paste sync
//
// Solves the real-world problem: files shared on WhatsApp become inaccessible
// after download on MIUI/ColorOS/OneUI due to Scoped Storage + SAF quirks.
// This service bypasses files entirely — sync happens through text messages.
//
// Wire format:
//   ====DM-SYNC v1 <chunkNum>/<totalChunks> <crc32>====
//   <base64-encoded-payload chunk>
//   ====END <chunkNum>/<totalChunks>====
//
// Payload is gzip-compressed JSON of {metadata, data} when CompressionStream
// is available; otherwise raw JSON string. The header flag `z=1` indicates gzip.

const PROTOCOL_VERSION = 'v1';
const HEADER_TAG = 'DM-SYNC';
const MAX_CHUNK_CHARS = 3500; // Safe for Android keyboards and WhatsApp paste
const LARGE_BLOB_WARN = 65000; // Total chars above which we strongly chunk

// ------- CRC32 (pure JS, no deps) -------

let CRC_TABLE = null;
function buildCrcTable() {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        }
        t[n] = c >>> 0;
    }
    return t;
}

function crc32(str) {
    if (!CRC_TABLE) CRC_TABLE = buildCrcTable();
    let c = 0xFFFFFFFF;
    // Encode to UTF-8 bytes so non-ASCII (Marathi/Hindi names) checksum correctly
    const bytes = new TextEncoder().encode(str);
    for (let i = 0; i < bytes.length; i++) {
        c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    }
    return ((c ^ 0xFFFFFFFF) >>> 0).toString(16).padStart(8, '0');
}

// ------- Base64 (UTF-8 safe) -------

function bytesToBase64(uint8) {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < uint8.length; i += chunk) {
        binary += String.fromCharCode.apply(null, uint8.subarray(i, i + chunk));
    }
    return btoa(binary);
}

function base64ToBytes(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

// ------- Compression (gzip via CompressionStream when available) -------

async function gzipString(str) {
    if (typeof CompressionStream === 'undefined') return null;
    const stream = new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'));
    const buf = await new Response(stream).arrayBuffer();
    return new Uint8Array(buf);
}

async function gunzipBytes(bytes) {
    if (typeof DecompressionStream === 'undefined') {
        throw new Error('Gzip decompression not supported on this device. Ask the sender to export without compression.');
    }
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).text();
}

// ------- Encode (payload → text blob) -------

/**
 * Encode a sync package into a WhatsApp-friendly text blob.
 * @param {object} pkg - sync package { metadata, data }
 * @returns {Promise<{text: string, chunkCount: number, sizeChars: number, compressed: boolean, warnLarge: boolean}>}
 */
async function encode(pkg) {
    const json = JSON.stringify(pkg);

    // Compress if possible
    let payloadBytes;
    let compressed = false;
    const gz = await gzipString(json);
    if (gz) {
        payloadBytes = gz;
        compressed = true;
    } else {
        payloadBytes = new TextEncoder().encode(json);
    }

    const b64 = bytesToBase64(payloadBytes);
    const checksum = crc32(b64);
    const totalChunks = Math.max(1, Math.ceil(b64.length / MAX_CHUNK_CHARS));
    const zFlag = compressed ? '1' : '0';

    const chunks = [];
    for (let i = 0; i < totalChunks; i++) {
        const chunkNum = i + 1;
        const start = i * MAX_CHUNK_CHARS;
        const end = Math.min(start + MAX_CHUNK_CHARS, b64.length);
        const chunkPayload = b64.slice(start, end);
        chunks.push(
            `====${HEADER_TAG} ${PROTOCOL_VERSION} ${chunkNum}/${totalChunks} z=${zFlag} c=${checksum}====\n` +
            chunkPayload +
            `\n====END ${chunkNum}/${totalChunks}====`
        );
    }

    const text = chunks.join('\n\n');
    return {
        text,
        chunkCount: totalChunks,
        sizeChars: text.length,
        compressed,
        warnLarge: text.length > LARGE_BLOB_WARN
    };
}

// ------- Decode (text blob → payload) -------

// Regex matches one chunk: header + payload + end marker, tolerant of whitespace and surrounding noise.
// Captures: 1=chunkNum, 2=totalChunks, 3=zFlag, 4=checksum, 5=payload
const CHUNK_REGEX = new RegExp(
    `====\\s*${HEADER_TAG}\\s+${PROTOCOL_VERSION}\\s+(\\d+)/(\\d+)\\s+z=([01])\\s+c=([0-9a-fA-F]{8})\\s*====` +
    `([\\s\\S]*?)` +
    `====\\s*END\\s+\\d+/\\d+\\s*====`,
    'g'
);

/**
 * Parse raw text (possibly containing WhatsApp timestamps or other noise)
 * and extract DM-SYNC chunks.
 * @returns {{chunks: Map<number, string>, total: number, checksum: string, compressed: boolean, missing: number[]}}
 */
function parseChunks(rawText) {
    const result = {
        chunks: new Map(),
        total: 0,
        checksum: null,
        compressed: false,
        missing: []
    };

    CHUNK_REGEX.lastIndex = 0;
    let match;
    while ((match = CHUNK_REGEX.exec(rawText)) !== null) {
        const num = parseInt(match[1], 10);
        const total = parseInt(match[2], 10);
        const zFlag = match[3] === '1';
        const checksum = match[4].toLowerCase();
        const payload = match[5].replace(/\s+/g, ''); // strip all whitespace inside payload

        // First chunk establishes the total/checksum — reject later chunks from a different export
        if (result.total === 0) {
            result.total = total;
            result.checksum = checksum;
            result.compressed = zFlag;
        } else if (result.total !== total || result.checksum !== checksum) {
            // Chunk from a different export — ignore
            continue;
        }

        if (num >= 1 && num <= total) {
            result.chunks.set(num, payload);
        }
    }

    if (result.total > 0) {
        for (let i = 1; i <= result.total; i++) {
            if (!result.chunks.has(i)) result.missing.push(i);
        }
    }

    return result;
}

/**
 * Decode a text blob back into a sync package.
 * @param {string} rawText - pasted text (may contain multiple chunks or noise)
 * @returns {Promise<{pkg: object}>}
 * @throws if no valid chunks found, chunks missing, or checksum fails
 */
async function decode(rawText) {
    if (!rawText || typeof rawText !== 'string') {
        throw new Error('No data pasted. Please paste the shared message.');
    }

    const parsed = parseChunks(rawText);

    if (parsed.total === 0) {
        throw new Error('No sync data found in pasted text. Make sure you copied the full message including the ====DM-SYNC==== markers.');
    }

    if (parsed.missing.length > 0) {
        const list = parsed.missing.join(', ');
        throw new Error(`Missing chunks: ${list} of ${parsed.total}. Paste the remaining messages from the sender.`);
    }

    // Reassemble in order
    let b64 = '';
    for (let i = 1; i <= parsed.total; i++) {
        b64 += parsed.chunks.get(i);
    }

    // Verify checksum
    const actualChecksum = crc32(b64);
    if (actualChecksum !== parsed.checksum) {
        throw new Error('Data integrity check failed. The message may have been corrupted during copy/paste. Ask the sender to re-send.');
    }

    // Decode base64 → bytes
    let bytes;
    try {
        bytes = base64ToBytes(b64);
    } catch {
        throw new Error('Pasted data is not valid. Copy the message again from the sender.');
    }

    // Decompress if needed
    let json;
    if (parsed.compressed) {
        json = await gunzipBytes(bytes);
    } else {
        json = new TextDecoder().decode(bytes);
    }

    let pkg;
    try {
        pkg = JSON.parse(json);
    } catch {
        throw new Error('Sync data is not valid JSON after decoding. Try re-copying from the sender.');
    }

    return { pkg };
}

// ------- Progress hint for partial pastes -------

/**
 * Inspect pasted text and report progress WITHOUT throwing.
 * Used to give live feedback as the user pastes chunks.
 * @returns {{status: 'empty'|'invalid'|'partial'|'complete', total: number, received: number, missing: number[], checksum: string}}
 */
function inspect(rawText) {
    if (!rawText || !rawText.trim()) {
        return { status: 'empty', total: 0, received: 0, missing: [], checksum: null };
    }
    const parsed = parseChunks(rawText);
    if (parsed.total === 0) {
        return { status: 'invalid', total: 0, received: 0, missing: [], checksum: null };
    }
    const received = parsed.chunks.size;
    if (parsed.missing.length === 0 && received === parsed.total) {
        return { status: 'complete', total: parsed.total, received, missing: [], checksum: parsed.checksum };
    }
    return { status: 'partial', total: parsed.total, received, missing: parsed.missing, checksum: parsed.checksum };
}

// ------- Web Share API wrapper -------

/**
 * Try to share text via the native share sheet (Android -> WhatsApp).
 * Falls back to clipboard copy when unavailable.
 * @returns {Promise<{method: 'share'|'clipboard'|'none', error?: string}>}
 */
async function shareText(text, title = 'Dnyani Mitra sync') {
    // Try Web Share API first
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        try {
            await navigator.share({ title, text });
            return { method: 'share' };
        } catch (e) {
            // User cancelled — not an error to surface
            if (e && e.name === 'AbortError') return { method: 'none' };
            // Fall through to clipboard
        }
    }
    // Fallback: clipboard
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return { method: 'clipboard' };
        } catch (e) {
            return { method: 'none', error: e.message };
        }
    }
    return { method: 'none', error: 'Neither share nor clipboard available on this device.' };
}

/**
 * Copy text to clipboard (no share sheet).
 */
async function copyText(text) {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
    }
    return false;
}

export default {
    encode,
    decode,
    inspect,
    shareText,
    copyText,
    // Exposed for tests
    _crc32: crc32,
    _parseChunks: parseChunks,
    _MAX_CHUNK_CHARS: MAX_CHUNK_CHARS
};
