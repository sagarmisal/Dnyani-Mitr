// Date Formatting Utilities

/**
 * Format ISO date to display format
 */
export function formatDate(isoDate, monthOnly = false) {
    // '—' rather than 'N/A' or 'Invalid Date'. Both of those are developer
    // words: they tell a volunteer that something is broken when the truthful
    // message is simply that we do not have this date. An em dash says that in
    // any language, and a record arriving through merge can carry anything.
    if (!isoDate) return '—';

    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return '—';

    const options = monthOnly
        ? { month: 'long', year: 'numeric' }
        : { month: 'short', day: 'numeric', year: 'numeric' };

    return date.toLocaleDateString('en-US', options);
}

/**
 * Format date for display (short format)
 */
export function formatDateShort(isoDate) {
    if (!isoDate) return '—';

    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return '—';

    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
    });
}

/**
 * Format timestamp to relative time (e.g., "2 days ago")
 */
export function formatRelativeTime(isoDate) {
    if (!isoDate) return 'Never';

    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return '—';

    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
}

/**
 * Get days until a date
 */
export function getDaysUntil(isoDate) {
    if (!isoDate) return NaN;

    const target = new Date(isoDate);
    if (isNaN(target.getTime())) return NaN;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);

    const diffMs = target - today;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Helper to get Local YYYY-MM-DD string
 */
export function toLocalISODate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Local calendar day of an instant, as YYYY-MM-DD.
 *
 * Interaction/action timestamps are stored as UTC (`getCurrentDate()` returns
 * `toISOString()`), so in IST anything recorded between 00:00 and 05:30 local
 * carries the PREVIOUS UTC date. Splitting such a timestamp on 'T' therefore
 * files it on the wrong day. Everything that groups records by day must key
 * through here instead.
 *
 * @param {string|Date} value - ISO timestamp or Date
 * @returns {string|null} local YYYY-MM-DD, or null if unusable
 */
export function localDayKey(value) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) return null;
    return toLocalISODate(date);
}

/**
 * Resolve an annually-recurring month/day onto a specific year, at local midnight.
 *
 * The day is CLAMPED to the real length of that month, so 29 Feb resolves to
 * 28 Feb in a non-leap year rather than overflowing into March (which is what
 * `new Date(year, 1, 29)` does on its own).
 *
 * @param {number} year - full year, e.g. 2026
 * @param {number} month - 1-12
 * @param {number} day - 1-31
 * @returns {Date|null} local-midnight Date, or null if the input is unusable
 */
export function resolveAnnualDate(year, month, day) {
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    const d = parseInt(day, 10);
    if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;

    const monthIndex = m - 1;
    const lastDayOfMonth = new Date(y, monthIndex + 1, 0).getDate();
    return new Date(y, monthIndex, Math.min(d, lastDayOfMonth));
}

/**
 * Normalize event date to current or next year
 */
export function normalizeEventDate(rawDate, monthOnly = false) {
    if (!rawDate) return null;
    const eventDate = new Date(rawDate);
    if (isNaN(eventDate.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Create event date for current year
    let normalized = new Date(
        today.getFullYear(),
        eventDate.getMonth(),
        monthOnly ? 1 : eventDate.getDate()
    );

    // If event has passed this year, move to next year (strict comparison to avoid moving today's event)
    // Note: dates are objects, so < works value-wise.
    if (normalized < today) {
        normalized = new Date(
            today.getFullYear() + 1,
            eventDate.getMonth(),
            monthOnly ? 1 : eventDate.getDate()
        );
    }

    return toLocalISODate(normalized);
}

/**
 * Check if date is valid
 */
export function isValidDate(dateString) {
    if (!dateString) return false;
    const date = new Date(dateString);
    return !isNaN(date.getTime());
}

/**
 * Get current date in ISO format (Full)
 */
export function getCurrentDate() {
    return new Date().toISOString();
}

/**
 * Get current date (date only, no time, LOCAL)
 */
export function getCurrentDateOnly() {
    return toLocalISODate(new Date());
}

/**
 * Format phone number for display
 */
export function formatPhone(phone) {
    if (!phone) return '';
    // Simple formatting - can be enhanced based on region
    return phone.trim();
}

/**
 * Normalize phone number for dedup matching.
 * Strips non-digits, takes last 10 digits.
 * Returns null if result is less than 10 digits.
 */
/**
 * Fold non-ASCII digits to ASCII (P1.5).
 *
 * `\D` in JavaScript is ASCII-only, so a number typed on a Devanagari layout
 * (९८२२०१२३४५) is stripped to nothing and normalizePhone returns null. The
 * phone number is this app's identity key (PR-1), so that silently costs a
 * visitor their identity — dedup misses them, sync will not match them, and
 * next year's reminder never finds them.
 *
 * Transliteration keyboards, which is how these volunteers actually type, keep
 * the number row ASCII — so this is uncommon rather than routine. It is cheap
 * insurance on the one field we ask people to get right.
 */
function foldDigits(str) {
    let out = '';
    for (const ch of String(str)) {
        const c = ch.codePointAt(0);
        if (c >= 0x0966 && c <= 0x096F) out += String(c - 0x0966);        // Devanagari ०-९
        else if (c >= 0x0660 && c <= 0x0669) out += String(c - 0x0660);   // Arabic-Indic ٠-٩
        else if (c >= 0x06F0 && c <= 0x06F9) out += String(c - 0x06F0);   // Extended Arabic-Indic ۰-۹
        else out += ch;
    }
    return out;
}

export function normalizePhone(phone) {
    if (!phone) return null;
    const digits = foldDigits(phone).replace(/\D/g, '');
    if (digits.length < 10) return null;
    return digits.slice(-10);
}

/**
 * Check if two names likely refer to the same person.
 * Rules: exact match, one contains the other, first word matches.
 */
export function namesSimilar(name1, name2) {
    if (!name1 || !name2) return false;
    const n1 = name1.trim().toLowerCase();
    const n2 = name2.trim().toLowerCase();
    if (!n1 || !n2) return false;

    // Exact match
    if (n1 === n2) return true;
    // One contains the other (e.g., "Suresh" vs "Suresh Patil")
    if (n1.includes(n2) || n2.includes(n1)) return true;
    // First word matches (e.g., "Suresh R." vs "Suresh Kumar")
    const first1 = n1.split(/\s+/)[0];
    const first2 = n2.split(/\s+/)[0];
    if (first1.length >= 2 && first1 === first2) return true;

    return false;
}

/**
 * Format email for display
 */
export function formatEmail(email) {
    if (!email) return '';
    return email.trim().toLowerCase();
}

/**
 * Pluralize a word based on count
 */
export function pluralize(count, singular, plural = null) {
    if (count === 1) return singular;
    return plural || `${singular}s`;
}

/**
 * What to show for a visitor in a list, a heading, or a day pane (D-07).
 *
 * A nameless visitor is ordinary now, not an error — someone rang, gave a
 * number, and hung up. Showing a blank row would make the record look broken;
 * showing the number makes it useful, because the number is what the next
 * person will search for anyway.
 *
 * DISPLAY ONLY. Never use this to address someone in a message: "Dear
 * 98220 12345 ji" is worse than sending nothing. Message composition reads the
 * real name and skips the recipient when there is none.
 */
export function visitorDisplayName(visitor) {
    if (!visitor) return 'Unknown';
    const contacts = Array.isArray(visitor.contacts) ? visitor.contacts : [];
    const self = contacts.find(c => c && c.relationType === 'SELF') || contacts[0];

    const name = self && self.name ? String(self.name).trim() : '';
    if (name) return name;

    const phone = normalizePhone((self && self.phones && self.phones[0]) || '');
    if (phone) return phone.slice(0, 5) + ' ' + phone.slice(5);   // 98220 12345

    return 'Unknown';
}
