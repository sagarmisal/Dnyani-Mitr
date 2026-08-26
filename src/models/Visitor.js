// Contact Model

import { generateId } from '../utils/helpers.js';
import { visitorDisplayName } from '../utils/formatters.js';
import { getCurrentDate } from '../utils/formatters.js';
import { RELATIONSHIP_TYPES } from '../utils/constants.js';

export class Visitor {
    constructor(data = {}) {
        this.id = data.id || generateId('visitor');
        this.primaryContactId = data.primaryContactId || null;
        this.category = data.category || '';
        this.tags = data.tags || [];
        this.status = data.status || 'active';
        this.customFields = data.customFields || {};
        this.address = data.address || '';
        this.city = data.city || '';
        this.communicationPreference = data.communicationPreference || 'whatsapp'; // whatsapp, call, sms, email, post
        this.notes = data.notes || '';
        this.contacts = data.contacts || [];
        this.createdAt = data.createdAt || getCurrentDate();
        this.updatedAt = data.updatedAt || getCurrentDate();
        this.deletedAt = data.deletedAt || null;
        this.createdBy = data.createdBy || null; // Machine ID
        this.updatedBy = data.updatedBy || null; // Machine ID
        // v3 fields
        this.consentGiven = data.consentGiven || false;
        this.consentDate = data.consentDate || null;
        this.doNotContact = data.doNotContact || false;
        this.contactFrequencyDays = data.contactFrequencyDays || null;
        this.engagementScore = data.engagementScore || 0;
        this.engagementUpdatedAt = data.engagementUpdatedAt || null;
        // Iter 11 (V10): how this record came to exist. A name heard over a
        // phone in Marathi is a name at risk of being misspelt, so intake
        // records must be findable for review later. Null for everything else.
        this.source = data.source || null;
    }

    /**
     * Get SELF contact
     */
    getSelfContact() {
        return this.contacts.find(c => c.relationType === RELATIONSHIP_TYPES.SELF);
    }

    /**
     * Get display name (from SELF contact)
     */
    getDisplayName() {
        // D-07 — falls back to the number, so a nameless record is legible
        // rather than a blank row. Display only; never used to address anyone.
        return visitorDisplayName(this);
    }

    /**
     * Add contact
     */
    addContact(contact) {
        this.contacts.push(contact);
        this.updatedAt = getCurrentDate();
    }

    /**
     * Update contact
     */
    updateContact(contactId, updates) {
        const index = this.contacts.findIndex(c => c.id === contactId);
        if (index !== -1) {
            this.contacts[index] = { ...this.contacts[index], ...updates };
            this.updatedAt = getCurrentDate();
            return true;
        }
        return false;
    }

    /**
     * Remove contact
     */
    removeContact(contactId) {
        const index = this.contacts.findIndex(c => c.id === contactId);
        if (index !== -1 && this.contacts[index].relationType !== RELATIONSHIP_TYPES.SELF) {
            this.contacts.splice(index, 1);
            this.updatedAt = getCurrentDate();
            return true;
        }
        return false;
    }

    /**
     * Check if visitor is active
     */
    isActive() {
        return this.status === 'active' && !this.deletedAt;
    }

    /**
     * Soft delete
     */
    delete() {
        this.deletedAt = getCurrentDate();
        this.status = 'deleted';
        this.updatedAt = getCurrentDate();
    }

    /**
     * Convert to plain object
     */
    toJSON() {
        return {
            id: this.id,
            primaryContactId: this.primaryContactId,
            category: this.category,
            tags: this.tags,
            status: this.status,
            customFields: this.customFields,
            address: this.address,
            city: this.city,
            communicationPreference: this.communicationPreference,
            notes: this.notes,
            contacts: this.contacts,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            deletedAt: this.deletedAt,
            createdBy: this.createdBy,
            source: this.source,
            updatedBy: this.updatedBy,
            consentGiven: this.consentGiven,
            consentDate: this.consentDate,
            doNotContact: this.doNotContact,
            contactFrequencyDays: this.contactFrequencyDays,
            engagementScore: this.engagementScore,
            engagementUpdatedAt: this.engagementUpdatedAt
        };
    }

    /**
     * Create from plain object
     */
    static fromJSON(data) {
        return new Visitor(data);
    }
}
