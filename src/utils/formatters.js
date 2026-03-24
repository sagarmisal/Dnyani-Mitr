// Date Formatting Utilities

/**
 * Format ISO date to display format
 */
export function formatDate(isoDate, monthOnly = false) {
    if (!isoDate) return 'N/A';

    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return 'Invalid Date';

    const options = monthOnly
        ? { month: 'long', year: 'numeric' }
        : { month: 'short', day: 'numeric', year: 'numeric' };

    return date.toLocaleDateString('en-US', options);
}

/**
 * Format date for display (short format)
 */
export function formatDateShort(isoDate) {
    if (!isoDate) return 'N/A';

    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return 'Invalid Date';

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
    if (isNaN(date.getTime())) return 'N/A';

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
function toLocalISOString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

    return toLocalISOString(normalized);
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
    return toLocalISOString(new Date());
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
