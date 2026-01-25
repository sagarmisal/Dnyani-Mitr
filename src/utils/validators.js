// Data Validators

import { VALIDATION, RELATIONSHIP_TYPES } from './constants.js';

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

    // Name is required
    if (!contact.name || contact.name.trim().length < VALIDATION.MIN_NAME_LENGTH) {
        errors.push(`Name must be at least ${VALIDATION.MIN_NAME_LENGTH} characters`);
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
