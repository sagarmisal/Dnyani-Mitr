// Data Validators

import { VALIDATION, RELATIONSHIP_TYPES } from './constants.js';
import { normalizePhone } from './formatters.js';

/**
 * Validate visitor object
 */
export function validateVisitor(visitor) {
    const errors = [];

    // Must have contacts array
    if (!visitor.contacts || !Array.isArray(visitor.contacts)) {
        errors.push('Visitor must have a contacts array');
        return { valid: false, errors };
    }

    // Must have exactly one SELF contact
    const selfContacts = visitor.contacts.filter(c => c.relationType === RELATIONSHIP_TYPES.SELF);
    if (selfContacts.length === 0) {
        errors.push('Visitor must have exactly one SELF contact');
    } else if (selfContacts.length > 1) {
        errors.push('Visitor cannot have more than one SELF contact');
    }

    // D-07 — the SELF contact must carry something we can find them by. A
    // phone is what we want (PR-1), but a caller who rings off without giving
    // one is a real case, and refusing to save it loses the visit entirely.
    // So: a phone, or failing that a name. Never neither — an anonymous empty
    // record cannot be found, thanked, or deduplicated, and quietly bloats
    // every list it appears in.
    const self = selfContacts[0];
    if (self) {
        const hasPhone = Array.isArray(self.phones) &&
            self.phones.some(ph => normalizePhone(ph));
        const hasName = !!(self.name && String(self.name).trim());
        if (!hasPhone && !hasName) {
            errors.push('Enter a phone number, or a name if they did not give one');
        }
    }

    // Validate each contact
    visitor.contacts.forEach((contact, index) => {
        const contactErrors = validateContact(contact);
        if (!contactErrors.valid) {
            errors.push(`Contact ${index + 1}: ${contactErrors.errors.join(', ')}`);
        }
    });

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Validate contact object
 */
export function validateContact(contact) {
    const errors = [];

    // D-07 — a name is NOT required. The app used to mandate the field with
    // spelling variance and treat the identity key as optional, which is
    // backwards: a volunteer taking a call who gets a number and no name could
    // not save at all, so they invented a name or recorded nothing. A minimum
    // length still applies to a name that IS given, to catch a stray keypress.
    if (contact.name && contact.name.trim().length > 0 &&
        contact.name.trim().length < VALIDATION.MIN_NAME_LENGTH) {
        errors.push(`A name, if given, must be at least ${VALIDATION.MIN_NAME_LENGTH} characters`);
    }

    if (contact.name && contact.name.length > VALIDATION.MAX_NAME_LENGTH) {
        errors.push(`Name cannot exceed ${VALIDATION.MAX_NAME_LENGTH} characters`);
    }

    // Validate relationship type
    if (!Object.values(RELATIONSHIP_TYPES).includes(contact.relationType)) {
        errors.push('Invalid relationship type');
    }

    // Validate phones if provided
    if (contact.phones && Array.isArray(contact.phones)) {
        contact.phones.forEach((phone, idx) => {
            if (phone && !VALIDATION.PHONE_PATTERN.test(phone)) {
                errors.push(`Phone ${idx + 1} has invalid format`);
            }
        });
    }

    // Validate emails if provided
    if (contact.emails && Array.isArray(contact.emails)) {
        contact.emails.forEach((email, idx) => {
            if (email && !VALIDATION.EMAIL_PATTERN.test(email)) {
                errors.push(`Email ${idx + 1} has invalid format`);
            }
        });
    }

    // Validate dates if provided
    if (contact.dob && !isValidDate(contact.dob)) {
        errors.push('Invalid date of birth');
    }

    if (contact.deathDate && !isValidDate(contact.deathDate)) {
        errors.push('Invalid death date');
    }

    if (contact.marriageDate && !isValidDate(contact.marriageDate)) {
        errors.push('Invalid marriage date');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Validate date string
 */
function isValidDate(dateString) {
    if (!dateString) return true; // Optional field
    const date = new Date(dateString);
    return !isNaN(date.getTime());
}

/**
 * Validate email
 */
export function validateEmail(email) {
    if (!email) return true; // Optional
    return VALIDATION.EMAIL_PATTERN.test(email);
}

/**
 * Validate phone
 */
export function validatePhone(phone) {
    if (!phone) return true; // Optional
    return VALIDATION.PHONE_PATTERN.test(phone);
}

/**
 * Validate master key format
 */
export function validateMasterKeyFormat(key) {
    if (!key) return false;
    return /^SSP-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key.toUpperCase());
}

/**
 * Sanitize string input
 */
export function sanitizeString(str, maxLength = 1000) {
    if (!str) return '';
    return str.trim().substring(0, maxLength);
}

/**
 * Validate import data structure
 */
export function validateImportData(data) {
    const errors = [];

    if (!data || typeof data !== 'object') {
        errors.push('Invalid data format');
        return { valid: false, errors };
    }

    // Check for required fields
    if (!data.visitors || !Array.isArray(data.visitors)) {
        errors.push('Missing or invalid visitors array');
    }

    if (!data.reminderActions || !Array.isArray(data.reminderActions)) {
        errors.push('Missing or invalid reminderActions array');
    }

    // Validate version compatibility
    if (data.version && !isCompatibleVersion(data.version)) {
        errors.push(`Incompatible version: ${data.version}`);
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Check version compatibility
 */
function isCompatibleVersion(version) {
    // For now, accept 2.x.x versions
    return version && version.startsWith('2.');
}
