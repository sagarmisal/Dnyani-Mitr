// Helper Utilities

/**
 * Generate a unique ID with optional prefix
 */
export function generateId(prefix = 'id') {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 11);
    return `${prefix}_${timestamp}_${randomStr}`;
}

/**
 * Generate a UUID v4
 */
export function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Deep clone an object
 */
export function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => deepClone(item));

    const clonedObj = {};
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            clonedObj[key] = deepClone(obj[key]);
        }
    }
    return clonedObj;
}

/**
 * Debounce function
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle function
 */
export function throttle(func, limit) {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Safely parse JSON
 */
export function safeJSONParse(str, fallback = null) {
    try {
        return JSON.parse(str);
    } catch (e) {
        console.error('JSON parse error:', e);
        return fallback;
    }
}

/**
 * Detect what sync paths the current device supports.
 * Used by SyncManager to label the right path as "Recommended" per platform.
 *
 * @returns {{
 *   canShareFiles: boolean,    // navigator.share with files - mobile + some desktops
 *   canShareText: boolean,     // navigator.share with text - mobile + some desktops
 *   canCopy: boolean,          // navigator.clipboard.writeText - all modern browsers
 *   canDownload: boolean,      // <a download> works - all desktops, unreliable in Capacitor WebView
 *   isCapacitor: boolean,      // running inside the Android APK
 *   platformLabel: string      // human-friendly description for UI hints
 * }}
 */
export function getSyncCapabilities() {
    const isCapacitor = !!(typeof window !== 'undefined'
        && window.Capacitor
        && typeof window.Capacitor.isNativePlatform === 'function'
        && window.Capacitor.isNativePlatform());

    const hasNav = typeof navigator !== 'undefined';
    const canShareText = hasNav && typeof navigator.share === 'function';

    // canShare with files probe — modern Capacitor WebView (Chrome 89+) supports this
    let canShareFiles = false;
    if (canShareText && typeof navigator.canShare === 'function') {
        try {
            // Probe with a tiny File to check files support specifically
            const probe = new File(['x'], 'probe.txt', { type: 'text/plain' });
            canShareFiles = navigator.canShare({ files: [probe] });
        } catch {
            canShareFiles = false;
        }
    }

    const canCopy = hasNav
        && navigator.clipboard
        && typeof navigator.clipboard.writeText === 'function';

    // Download anchor works on every desktop browser. On Capacitor WebView the
    // <a download> click does fire but the resulting file lands in app-private
    // storage where the user can't access it, so we treat it as unreliable on Capacitor.
    const canDownload = !isCapacitor;

    let platformLabel = 'desktop';
    if (isCapacitor) platformLabel = 'Android app';
    else if (hasNav && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) platformLabel = 'mobile browser';

    return { canShareFiles, canShareText, canCopy, canDownload, isCapacitor, platformLabel };
}

/**
 * Save content to a file the user can access. Platform-aware:
 *
 * - Mobile / Capacitor: opens the system share sheet so the user can route
 *   the file to WhatsApp / Drive / Email / Files. This is the path that
 *   actually works on MIUI/ColorOS where in-WebView downloads disappear.
 * - Desktop: triggers a normal browser download.
 *
 * Returns a Promise so callers can await and surface platform-appropriate
 * feedback (e.g. "Share sheet opened" vs "File downloaded"). Existing call
 * sites that don't await still work — the operation fires and the promise
 * is harmlessly discarded.
 *
 * @param {string} content
 * @param {string} filename
 * @param {string} [mimeType='application/json']
 * @returns {Promise<{method: 'share'|'download'|'datauri', cancelled?: boolean, error?: string}>}
 */
export async function saveFile(content, filename, mimeType = 'application/json') {
    const blob = new Blob([content], { type: mimeType });
    const caps = getSyncCapabilities();

    // Path 1: Web Share API with files — best path on Capacitor + mobile browsers.
    if (caps.canShareFiles) {
        try {
            const file = new File([blob], filename, { type: mimeType });
            await navigator.share({ files: [file], title: filename });
            return { method: 'share', cancelled: false };
        } catch (err) {
            if (err && err.name === 'AbortError') {
                return { method: 'share', cancelled: true };
            }
            // Share failed for some other reason — fall through to download.
        }
    }

    // Path 2: Standard browser download.
    try {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        await new Promise((resolve) => setTimeout(() => {
            link.click();
            setTimeout(() => {
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                resolve();
            }, 250);
        }, 0));
        return { method: 'download', cancelled: false };
    } catch (err) {
        // Final fallback: data URI in new tab. Last resort for very old WebViews.
        try {
            const dataUri = 'data:' + mimeType + ';charset=utf-8,' + encodeURIComponent(content);
            window.open(dataUri, '_blank');
            return { method: 'datauri', cancelled: false };
        } catch (err2) {
            return { method: 'download', cancelled: false, error: err2.message || String(err2) };
        }
    }
}

/**
 * Backward-compat alias. Existing callers do not await, so the returned
 * Promise is harmlessly discarded.
 * @deprecated use saveFile() and await it for proper UX feedback
 */
export function downloadFile(content, filename, mimeType = 'application/json') {
    return saveFile(content, filename, mimeType);
}

/**
 * Escape HTML to prevent XSS
 */
export function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Truncate text with ellipsis
 */
export function truncate(str, maxLength = 50) {
    if (!str || str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
}

/**
 * Sort array of objects by key
 */
export function sortBy(array, key, order = 'asc') {
    return [...array].sort((a, b) => {
        const aVal = a[key];
        const bVal = b[key];

        if (aVal < bVal) return order === 'asc' ? -1 : 1;
        if (aVal > bVal) return order === 'asc' ? 1 : -1;
        return 0;
    });
}

/**
 * Group array by key
 */
export function groupBy(array, key) {
    return array.reduce((result, item) => {
        const group = item[key];
        if (!result[group]) result[group] = [];
        result[group].push(item);
        return result;
    }, {});
}

/**
 * Calculate hash for a string (simple hash for offline validation)
 */
export function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
}
