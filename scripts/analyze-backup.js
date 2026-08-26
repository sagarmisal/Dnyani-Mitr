#!/usr/bin/env node
/**
 * analyze-backup.js — read a Dnyani Mitr backup and report what is actually used.
 *
 * WHY THIS EXISTS
 * ---------------
 * The app is offline by design, so there is no telemetry and never should be.
 * But the NGOs already send us backups over WhatsApp for safekeeping. That file
 * carries everything we need to know — in aggregate — about which parts of the
 * app are used, whether it is still open on day 40, and whether anyone has
 * backed up recently. Reading it turns the next roadmap decision from a guess
 * into evidence, without shipping a single line of tracking code.
 *
 * THE HARD RULE
 * -------------
 * This script NEVER prints personal data. Not a name, not a phone number, not a
 * birthday, not a note. Only counts, dates, versions and fixed labels. A guard
 * at the end scans the output and refuses to print if anything resembling a
 * phone number or a personal string slipped through. If you extend this script,
 * that guard is the contract — do not weaken it.
 *
 * TELL THE NGO. Reading their backup is a service only if they know about it.
 * "When you send us a backup we check the counts, so we build the right things
 * next" is honest. Doing it quietly is not, whatever the intent.
 *
 * USAGE
 *   node scripts/analyze-backup.js <file> [<file> ...]
 *   node scripts/analyze-backup.js --json <file>      # machine-readable
 *   cat backup.txt | node scripts/analyze-backup.js -
 *
 * Accepts either a WhatsApp text backup (====DM-SYNC==== chunks, one or many
 * messages concatenated) or a plain .json export.
 */

import fs from 'node:fs';
import zlib from 'node:zlib';

// ---------------------------------------------------------------- wire format
// Mirrors src/services/TextSyncService.js. Kept deliberately separate: this
// script must be able to read backups from OLDER app versions than the one in
// the working tree, so it does not import from src/.

const CHUNK_RE = /^====DM-SYNC\s+(\S+)\s+(\d+)\/(\d+)\s+z=(\d)\s+c=(-?\d+)====$/;

let CRC_TABLE = null;
function buildCrcTable() {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c;
    }
    return t;
}
function crc32(str) {
    if (!CRC_TABLE) CRC_TABLE = buildCrcTable();
    let c = 0 ^ -1;
    const bytes = Buffer.from(str, 'utf8');
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
}

/** Parse DM-SYNC chunks out of pasted text. Tolerates extra WhatsApp cruft. */
function parseChunks(raw) {
    const lines = raw.split(/\r?\n/);
    const chunks = new Map();
    let total = 0, checksum = null, compressed = false, version = null;
    let current = null, buf = [];

    for (const line of lines) {
        const m = CHUNK_RE.exec(line.trim());
        if (m) {
            version = m[1];
            current = parseInt(m[2], 10);
            total = parseInt(m[3], 10);
            compressed = m[4] === '1';
            checksum = parseInt(m[5], 10) >>> 0;
            buf = [];
            continue;
        }
        if (/^====END\s+\d+\/\d+====$/.test(line.trim())) {
            if (current != null) chunks.set(current, buf.join(''));
            current = null; buf = [];
            continue;
        }
        if (current != null && line.trim()) buf.push(line.trim());
    }
    // A truncated paste may lack the final ====END====; keep what we have.
    if (current != null && buf.length) chunks.set(current, buf.join(''));

    const missing = [];
    for (let i = 1; i <= total; i++) if (!chunks.has(i)) missing.push(i);
    return { chunks, total, missing, checksum, compressed, version };
}

function decodeTextBackup(raw) {
    const p = parseChunks(raw);
    if (p.total === 0) return null;                       // not a text backup

    const notes = [];
    if (p.missing.length) {
        throw new Error(
            `Incomplete paste: missing chunk(s) ${p.missing.join(', ')} of ${p.total}. ` +
            `Ask the sender for the remaining WhatsApp message(s).`
        );
    }

    let b64 = '';
    for (let i = 1; i <= p.total; i++) b64 += p.chunks.get(i);

    // Refuse on a bad checksum rather than pressing on. Decompression may well
    // succeed on corrupted bytes and yield counts that are quietly wrong — and a
    // number that is wrong without saying so is worse than no number at all.
    const actual = crc32(b64);
    const crcOk = actual === p.checksum;
    if (!crcOk) {
        throw new Error(
            'Checksum mismatch — this backup was corrupted in copy/paste, so any ' +
            'counts read from it would be wrong. Ask the sender to re-send the ' +
            'WhatsApp message(s) without editing them.'
        );
    }

    const bytes = Buffer.from(b64, 'base64');
    let json;
    try {
        json = p.compressed ? zlib.gunzipSync(bytes).toString('utf8') : bytes.toString('utf8');
    } catch (e) {
        throw new Error('Backup passed its checksum but could not be decompressed (' +
                        e.message + '). It may have been produced by a newer app version.');
    }
    return {
        pkg: JSON.parse(json),
        transport: {
            kind: 'whatsapp-text', chunks: p.total, protocol: p.version,
            compressed: p.compressed, crcOk, chars: b64.length, notes
        }
    };
}

function load(path) {
    const raw = path === '-'
        ? fs.readFileSync(0, 'utf8')
        : fs.readFileSync(path, 'utf8');

    const trimmed = raw.trim();
    if (trimmed.startsWith('{')) {
        return {
            pkg: JSON.parse(trimmed),
            transport: { kind: 'json-file', chars: trimmed.length, crcOk: null, notes: [] }
        };
    }
    const decoded = decodeTextBackup(raw);
    if (decoded) return decoded;
    throw new Error('Not a Dnyani Mitr backup: no ====DM-SYNC==== markers and not JSON.');
}

// ------------------------------------------------------------------- analysis

const DAY = 86400000;
const isDev = ch => { const c = ch.codePointAt(0); return c >= 0x0900 && c <= 0x097F; };

function scriptOf(s) {
    if (!s) return 'empty';
    let dev = 0, lat = 0;
    for (const ch of String(s)) {
        if (isDev(ch)) dev++;
        else if (/[A-Za-z]/.test(ch)) lat++;
    }
    if (dev && lat) return 'mixed';
    if (dev) return 'devanagari';
    if (lat) return 'latin';
    return 'other';
}

function normPhone(p) {
    if (!p) return null;
    const d = String(p).replace(/[^0-9]/g, '');
    return d.length >= 10 ? d.slice(-10) : null;
}

function monthKey(iso) {
    const d = new Date(iso);
    return isNaN(d) ? null : `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function analyze(pkg, transport, now) {
    const meta = pkg.metadata || {};
    const d = pkg.data || pkg;                    // tolerate un-wrapped exports

    const visitors      = d.visitors        || [];
    const interactions  = d.interactions    || [];
    const scheduled     = d.scheduledItems  || [];
    const campaigns     = d.campaigns       || [];
    const occasions     = d.occasions       || [];
    const settings      = d.settings        || {};
    const syncLog       = d.syncLog         || [];

    // settings and knownMachines are objects, the rest arrays — so test for
    // presence, not shape. Getting this wrong reported a full backup as partial.
    const present = k => d[k] !== undefined && d[k] !== null;
    const live = visitors.filter(v => !v.isDeleted);

    // --- activity over the last 12 months -----------------------------------
    const months = [];
    const cursor = new Date(now);
    for (let i = 11; i >= 0; i--) {
        const dt = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() - i, 1));
        months.push(`${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`);
    }
    const byMonth = new Map(months.map(m => [m, 0]));
    let lastInteraction = null;
    for (const i of interactions) {
        const k = monthKey(i.interactionDate);
        if (k && byMonth.has(k)) byMonth.set(k, byMonth.get(k) + 1);
        const t = new Date(i.interactionDate).getTime();
        if (!isNaN(t) && (lastInteraction === null || t > lastInteraction)) lastInteraction = t;
    }

    // --- data health, measured against our own principles -------------------
    const phoneCounts = new Map();
    let noPhone = 0, noName = 0, withBirthday = 0;
    const script = { devanagari: 0, latin: 0, mixed: 0, other: 0, empty: 0 };

    for (const v of live) {
        const contacts = Array.isArray(v.contacts) ? v.contacts : [];
        const self = contacts.find(c => c.relationType === 'SELF') || contacts[0] || {};
        const phones = Array.isArray(self.phones) ? self.phones : [];
        const norm = phones.map(normPhone).filter(Boolean);
        if (!norm.length) noPhone++;
        for (const n of norm) phoneCounts.set(n, (phoneCounts.get(n) || 0) + 1);
        if (!self.name || !String(self.name).trim()) noName++;
        script[scriptOf(self.name)]++;
        for (const c of contacts) {
            if (c.dateOfBirth || (Array.isArray(c.events) && c.events.length)) { withBirthday++; break; }
        }
    }
    const dupPhones = [...phoneCounts.values()].filter(n => n > 1).length;

    const interactedIds = new Set(interactions.map(i => i.visitorId));
    const neverInteracted = live.filter(v => !interactedIds.has(v.id)).length;

    // --- calendar use (does Iteration 11 earn its place?) -------------------
    const sched = {
        total: scheduled.length,
        inbound:  scheduled.filter(s => s.direction === 'inbound').length,
        outbound: scheduled.filter(s => s.direction !== 'inbound').length,
        done:     scheduled.filter(s => s.status === 'done').length,
        noShow:   scheduled.filter(s => s.outcome === 'no_show').length,
        withPhone: scheduled.filter(s => normPhone(s.phone)).length
    };

    // --- campaigns (does Iteration 10 earn its place?) ---------------------
    const customOccasions = occasions.filter(o => !o.builtin).length;
    const datedMovable = occasions.filter(o =>
        o.movable && o.dates && Object.keys(o.dates).length > 0).length;
    const movableTotal = occasions.filter(o => o.movable).length;

    // --- did anyone find Settings? ----------------------------------------
    const touched = {
        orgName:  !!(settings.organizationName && settings.organizationName !== 'Sewa Sankalp Pratishthan'),
        templates: !!settings.messageTemplates,
        landing:  !!settings.landingRoute,
        campaignLang: !!settings.defaultCampaignLanguage
    };

    const exportedAt = meta.exportedAt ? new Date(meta.exportedAt).getTime() : null;

    return {
        provenance: {
            appVersion: meta.version || 'unknown',
            backupType: meta.backupType || (present('settings') ? 'full?' : 'partial?'),
            machineRole: meta.machineRole || 'unknown',
            exportedAt: meta.exportedAt || null,
            daysSinceBackup: exportedAt ? Math.floor((now - exportedAt) / DAY) : null,
            collections: meta.collections || Object.keys(d),
            transport
        },
        alive: {
            interactions: interactions.length,
            lastInteractionDaysAgo: lastInteraction ? Math.floor((now - lastInteraction) / DAY) : null,
            months, byMonth: months.map(m => byMonth.get(m))
        },
        people: {
            visitors: live.length,
            softDeleted: visitors.length - live.length,
            noPhone, noName, dupPhones, neverInteracted, withBirthday, script
        },
        calendar: sched,
        campaigns: {
            campaigns: campaigns.length,
            occasions: occasions.length,
            customOccasions, movableTotal, datedMovable
        },
        settingsTouched: touched,
        syncs: syncLog.length,
        missingCollections: ['visitors','interactions','reminderActions','occasions','campaigns',
                             'scheduledItems','settings','syncLog','knownMachines'].filter(k => !present(k))
    };
}

// -------------------------------------------------------------------- report

const B = s => `\x1b[1m${s}\x1b[0m`;
const DIM = s => `\x1b[2m${s}\x1b[0m`;
const RED = s => `\x1b[31m${s}\x1b[0m`;
const YEL = s => `\x1b[33m${s}\x1b[0m`;
const GRN = s => `\x1b[32m${s}\x1b[0m`;

function sparkline(values) {
    const blocks = '·▁▂▃▄▅▆▇█';   // '·' not ' ' so an empty month is visible
    const max = Math.max(...values, 1);
    return values.map(v => blocks[Math.min(8, Math.round((v / max) * 8))]).join('');
}
function pct(n, d) { return d ? Math.round((n / d) * 100) : 0; }
function line(label, value, note) {
    const L = ('  ' + label).padEnd(34);
    return L + String(value) + (note ? '  ' + DIM(note) : '');
}

function report(a, label) {
    const out = [];
    const P = a.provenance;

    out.push('');
    out.push(B('━'.repeat(66)));
    out.push(B('  ' + label));
    out.push(B('━'.repeat(66)));

    out.push('');
    out.push(B('WHERE THIS CAME FROM'));
    out.push(line('App version', P.appVersion));
    out.push(line('Backup type', P.backupType));
    out.push(line('Machine role', P.machineRole));
    out.push(line('Taken', P.exportedAt ? P.exportedAt.slice(0, 10) : 'unknown',
        P.daysSinceBackup != null ? `${P.daysSinceBackup} days ago` : ''));
    out.push(line('Transport', P.transport.kind,
        P.transport.kind === 'whatsapp-text'
            ? `${P.transport.chunks} message(s), ${P.transport.chars.toLocaleString()} chars`
            : `${P.transport.chars.toLocaleString()} chars`));
    if (P.transport.crcOk === true)  out.push(line('Integrity', GRN('checksum OK')));
    if (P.transport.crcOk === false) out.push(line('Integrity', RED('CHECKSUM MISMATCH')));
    if (a.missingCollections.length)
        out.push(line('Missing collections', YEL(a.missingCollections.join(', ')),
            'a partial backup — restoring this will not bring these back'));

    out.push('');
    out.push(B('IS IT STILL BEING USED?') + DIM('   ← the question that matters most'));
    const V = a.alive;
    out.push(line('Interactions recorded', V.interactions.toLocaleString()));
    out.push(line('Last activity',
        V.lastInteractionDaysAgo == null ? RED('never')
        : V.lastInteractionDaysAgo <= 7  ? GRN(`${V.lastInteractionDaysAgo} days ago`)
        : V.lastInteractionDaysAgo <= 30 ? YEL(`${V.lastInteractionDaysAgo} days ago`)
        : RED(`${V.lastInteractionDaysAgo} days ago`)));
    out.push('  ' + 'Last 12 months'.padEnd(32) + sparkline(V.byMonth));
    out.push('  ' + ''.padEnd(32) + DIM(V.months[0] + ' → ' + V.months[11]));
    out.push('  ' + ''.padEnd(32) + DIM('monthly: ' + V.byMonth.join(' ')));

    out.push('');
    out.push(B('PEOPLE, AND DATA HEALTH'));
    const H = a.people;
    out.push(line('Visitors', H.visitors.toLocaleString(),
        H.softDeleted ? `+${H.softDeleted} deleted` : ''));
    out.push(line('With no phone number', H.noPhone,
        H.visitors ? `${pct(H.noPhone, H.visitors)}% — cannot be matched on sync or found by number` : ''));
    out.push(line('With no name', H.noName));
    out.push(line('Duplicate phone numbers', H.dupPhones,
        H.dupPhones ? 'same number on more than one visitor' : ''));
    out.push(line('Never interacted with', H.neverInteracted,
        H.visitors ? `${pct(H.neverInteracted, H.visitors)}% of the list` : ''));
    out.push(line('Carrying a birthday/event', H.withBirthday,
        H.visitors ? `${pct(H.withBirthday, H.visitors)}% — this is what feeds reminders` : ''));
    out.push(line('Name script', `देवनागरी ${H.script.devanagari} · Latin ${H.script.latin} · mixed ${H.script.mixed}`));

    out.push('');
    out.push(B('IS THE CALENDAR USED?') + DIM('   ← does Iteration 11 earn its place'));
    const C = a.calendar;
    out.push(line('Scheduled items', C.total, C.total === 0 ? RED('never used') : ''));
    if (C.total) {
        out.push(line('Inbound (someone coming)', C.inbound, `${pct(C.inbound, C.total)}%`));
        out.push(line('Outbound (we are going)', C.outbound, `${pct(C.outbound, C.total)}%`));
        out.push(line('Completed', C.done));
        out.push(line('Marked no-show', C.noShow));
        out.push(line('Linked to a phone number', C.withPhone, `${pct(C.withPhone, C.total)}%`));
    }

    out.push('');
    out.push(B('ARE CAMPAIGNS USED?') + DIM('   ← does Iteration 10 earn its place'));
    const M = a.campaigns;
    out.push(line('Campaigns ever created', M.campaigns, M.campaigns === 0 ? RED('never used') : ''));
    out.push(line('Occasions', M.occasions, `${M.customOccasions} added by the NGO`));
    out.push(line('Movable festivals dated', `${M.datedMovable} / ${M.movableTotal}`,
        M.movableTotal && !M.datedMovable ? 'none dated — festival greetings cannot fire' : ''));

    out.push('');
    out.push(B('DID ANYONE FIND SETTINGS?'));
    const S = a.settingsTouched;
    const mark = b => b ? GRN('yes') : DIM('no');
    out.push(line('Organisation name changed', mark(S.orgName)));
    out.push(line('Message templates saved', mark(S.templates)));
    out.push(line('Opening screen chosen', mark(S.landing)));
    out.push(line('Campaign language set', mark(S.campaignLang)));
    out.push(line('Syncs recorded', a.syncs));

    out.push('');
    out.push(B('WHAT THIS DOES NOT TELL YOU'));
    out.push(DIM('  Screens opened, buttons pressed, or anything not written to storage.'));
    out.push(DIM('  A zero here means "no record was created", not always "never tried".'));
    out.push(DIM('  One backup is a snapshot. Trends need two, taken weeks apart.'));
    out.push('');

    return out.join('\n');
}

// ------------------------------------------------- PII guard (the hard rule)
// Structural guarantee: nothing above ever copies a value out of the data. This
// is belt-and-braces in case a future edit does.
function assertNoPII(text) {
    const stripped = text.replace(/\x1b\[[0-9;]*m/g, '');
    const problems = [];
    // Any run of 10+ digits — a phone number, an Aadhaar, an account number.
    for (const m of stripped.matchAll(/\d{10,}/g)) problems.push(`digit run "${m[0]}"`);
    // Long Devanagari runs: our own labels are short (देवनागरी). A name would be longer.
    for (const m of stripped.matchAll(/[ऀ-ॿ]{12,}/g)) problems.push('long Devanagari run');
    if (problems.length) {
        console.error('\n\x1b[31mREFUSING TO PRINT: output may contain personal data.\x1b[0m');
        console.error('  ' + problems.slice(0, 5).join('\n  '));
        console.error('  This is the PII guard in analyze-backup.js. Fix the report code.\n');
        process.exit(2);
    }
}

// ---------------------------------------------------------------------- main
function main() {
    const argv = process.argv.slice(2);
    const asJson = argv.includes('--json');
    const files = argv.filter(a => a !== '--json');

    if (!files.length) {
        console.error('usage: node scripts/analyze-backup.js [--json] <file> [<file> ...]');
        console.error('       cat backup.txt | node scripts/analyze-backup.js -');
        process.exit(1);
    }

    const now = Date.now();
    const results = [];

    for (const f of files) {
        let loaded;
        try {
            loaded = load(f);
        } catch (err) {
            console.error(`\n\x1b[31m${f}: ${err.message}\x1b[0m`);
            process.exitCode = 1;
            continue;
        }
        const a = analyze(loaded.pkg, loaded.transport, now);
        results.push({ file: f, analysis: a });
        for (const n of loaded.transport.notes) console.error(`\x1b[33m${f}: ${n}\x1b[0m`);
    }

    if (!results.length) process.exit(1);

    if (asJson) {
        // File paths can carry an NGO's name; report by index instead.
        const payload = results.map((r, i) => ({ index: i + 1, ...r.analysis }));
        const text = JSON.stringify(payload, null, 2);
        assertNoPII(text);
        console.log(text);
        return;
    }

    let out = '';
    results.forEach((r, i) => { out += report(r.analysis, `Backup ${i + 1} of ${results.length}`); });

    if (results.length > 1) {
        out += '\n' + B('SIDE BY SIDE') + '\n';
        const row = (label, fn) =>
            '  ' + label.padEnd(28) + results.map(r => String(fn(r.analysis)).padStart(10)).join('') + '\n';
        out += '  ' + ''.padEnd(28) + results.map((_, i) => `  backup ${i + 1}`.padStart(10)).join('') + '\n';
        out += row('visitors',        a => a.people.visitors);
        out += row('interactions',    a => a.alive.interactions);
        out += row('no phone number', a => a.people.noPhone);
        out += row('scheduled items', a => a.calendar.total);
        out += row('campaigns',       a => a.campaigns.campaigns);
        out += row('days since backup', a => a.provenance.daysSinceBackup ?? '?');
        out += row('app version',     a => a.provenance.appVersion);
        out += '\n';
    }

    assertNoPII(out);
    console.log(out);
}

main();
