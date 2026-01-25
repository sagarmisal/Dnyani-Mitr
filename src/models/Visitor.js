// Contact Model

import { generateId } from '../utils/helpers.js';
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
        const self = this.getSelfContact();
        return self ? self.name : 'Unknown';
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
            updatedBy: this.updatedBy
        };
    }

    /**
     * Create from plain object
     */
    static fromJSON(data) {
        return new Visitor(data);
    }
}
