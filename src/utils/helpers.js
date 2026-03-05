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
 * Download a file (with Android/Capacitor fallback)
 */
export function downloadFile(content, filename, mimeType = 'application/json') {
    try {
        const blob = new Blob([content], { type: mimeType });

        // Check if running inside Capacitor/Android WebView
        // where URL.createObjectURL may not trigger a download
        if (window.navigator && window.navigator.msSaveOrOpenBlob) {
            // IE/Edge legacy
            window.navigator.msSaveOrOpenBlob(blob, filename);
            return;
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);

        // Use setTimeout to ensure the click registers on all WebViews
        setTimeout(() => {
            link.click();
            setTimeout(() => {
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }, 250);
        }, 0);
    } catch (err) {
        // Final fallback: open data URI in new tab
        console.error('Download failed, trying data URI fallback:', err);
        const dataUri = 'data:' + mimeType + ';charset=utf-8,' + encodeURIComponent(content);
        window.open(dataUri, '_blank');
    }
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
