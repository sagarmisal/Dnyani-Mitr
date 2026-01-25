// Simple cryptographic utilities for offline key validation

import { simpleHash } from './helpers.js';

/**
 * Validate master key
 * Uses a simple hash-based validation that works offline
 */
export function validateMasterKey(key) {
    if (!key) return false;

    // Normalize key
    const normalizedKey = key.toUpperCase().trim();

    // Check format: SSP-XXXX-XXXX-XXXX
    if (!/^SSP-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(normalizedKey)) {
        return false;
    }

    // For development: accept dev key
    if (normalizedKey === 'SSP-DEV1-2026-TEST') {
        return true;
    }

    // Production validation: check against embedded hash
    // This is a simple implementation - Sewa Sankalp can enhance this
    const keyHash = simpleHash(normalizedKey);
    const validHashes = getValidKeyHashes();

    return validHashes.includes(keyHash);
}

/**
 * Get list of valid key hashes
 * In production, Sewa Sankalp would embed actual key hashes here
 */
function getValidKeyHashes() {
    // Development key hash
    const devKeyHash = simpleHash('SSP-DEV1-2026-TEST');

    // Sewa Sankalp would add production key hashes here
    // Example: '1a2b3c4d', '5e6f7g8h', etc.

    return [
        devKeyHash,
        'azia10', // SSP-PROD-2026-KEY1
        '385p02', // SSP-NGOV-MANG-2026
        '8nibbu'  // SSP-SEWA-SANK-ALP1
    ];
}

/**
 * Generate a master key (for Sewa Sankalp internal use only)
 * This function would be used by Sewa Sankalp to generate keys
 */
export function generateMasterKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const parts = [];

    for (let i = 0; i < 3; i++) {
        let part = '';
        for (let j = 0; j < 4; j++) {
            part += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        parts.push(part);
    }

    const key = `SSP-${parts.join('-')}`;
    const hash = simpleHash(key);

    return {
        key,
        hash,
        instructions: `Add hash "${hash}" to getValidKeyHashes() in crypto.js`
    };
}

/**
 * Hash a string for storage (simple implementation)
 */
export function hashString(str) {
    return simpleHash(str);
}
