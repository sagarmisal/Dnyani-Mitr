// Visitor Service - CRUD operations and business logic

import StateManager from '../core/state.js';
import { normalizeText, foldKey } from '../utils/devanagari.js';
import EventBus, { EVENTS } from '../core/events.js';
import { Visitor } from '../models/Visitor.js';
import { Contact } from '../models/Contact.js';
import { validateVisitor } from '../utils/validators.js';
import { getCurrentDate, normalizePhone } from '../utils/formatters.js';
import ActivationManager from '../core/activation.js';

class VisitorService {
    /**
     * Get all active visitors
     */
    getAll(includeDeleted = false) {
        const visitors = StateManager.getVisitors();

        if (includeDeleted) {
            return visitors;
        }

        return visitors.filter(v => v.status === 'active' && !v.deletedAt);
    }

    /**
     * Get visitor by ID
     */
    getById(id) {
        const visitors = StateManager.getVisitors();
        return visitors.find(v => v.id === id);
    }

    /**
     * Search visitors
     */
    /**
     * Find a visitor by any phone number on any of their contacts (P1.7, DF-2).
     *
     * Lookup used to search only the SELF contact, so a supporter who gives the
     * number we hold for their spouse or son appeared as a new person — and the
     * intake screen offered to create a duplicate of someone already in the
     * register. On a phone call that is exactly the moment we cannot afford it.
     *
     * Deliberately WIDER than sync's identity rule, which still matches on the
     * SELF contact's first number only. Widening lookup helps a human find
     * someone; widening merge would fuse two households that share a landline.
     * Different jobs, different rules (D-18's principle: suggest, never merge).
     *
     * @returns {{visitor: Object, contact: Object, isSelf: boolean}|null}
     */
    findByPhone(phone) {
        const target = normalizePhone(phone);
        if (!target) return null;

        for (const visitor of this.getAll()) {
            const contacts = Array.isArray(visitor.contacts) ? visitor.contacts : [];
            // SELF first, so the common case reports the person themselves.
            const ordered = [
                ...contacts.filter(c => c.relationType === 'SELF'),
                ...contacts.filter(c => c.relationType !== 'SELF')
            ];
            for (const contact of ordered) {
                const phones = Array.isArray(contact.phones) ? contact.phones : [];
                if (phones.some(p => normalizePhone(p) === target)) {
                    return { visitor, contact, isSelf: contact.relationType === 'SELF' };
                }
            }
        }
        return null;
    }

    search(query, options = {}) {
        const {
            category = null,
            city = null, // New parameter
            tags = [],
            status = 'active',
            includeDeleted = false
        } = options;

        let visitors = this.getAll(includeDeleted);

        // Filter by status
        if (status) {
            visitors = visitors.filter(v => v.status === status);
        }

        // Filter by category
        if (category) {
            visitors = visitors.filter(v => v.category === category);
        }

        // Filter by City
        if (city) {
            visitors = visitors.filter(v => v.city === city);
        }

        // Filter by tags
        if (tags.length > 0) {
            visitors = visitors.filter(v =>
                tags.some(tag => v.tags.includes(tag))
            );
        }

        // Search query
        if (query && query.trim()) {
            // P1.2 — NFC the query so it can match names stored in either form.
            const q = normalizeText(query).toLowerCase().trim();

            // P1.1 — the fold key, so a Latin query finds a Devanagari record.
            // Volunteers type with a transliteration keyboard and think in
            // Latin, so "sunita" must find सुनीता. This is strictly ADDITIVE:
            // it can only widen the result set, never narrow it, so no existing
            // search stops working. Whether it holds up on real Maharashtrian
            // surnames is Q-05, and needs a real name list to tune against.
            // Only fold-match once the key is long enough to mean something.
            // foldKey('a') is 'a' and foldKey('zzzzz') collapses to 'j' — a one
            // or two character key is a substring of almost every name, so
            // below this threshold the fold would match the entire register.
            const rawFold = foldKey(q);
            const qFold = rawFold.length >= 3 ? rawFold : '';
            const qDigits = q.replace(/[^0-9]/g, '');

            visitors = visitors.filter(v => {
                // Search in visitor fields
                if (v.category && v.category.toLowerCase().includes(q)) return true;
                if (v.city && v.city.toLowerCase().includes(q)) return true; // Search by City
                if (v.notes && v.notes.toLowerCase().includes(q)) return true;
                if (v.tags.some(tag => tag.toLowerCase().includes(q))) return true;

                // Search in contacts
                return v.contacts.some(c => {
                    const name = normalizeText(c.name || '');
                    if (name.toLowerCase().includes(q)) return true;
                    // Fold both sides; substring so a first name finds a full name.
                    if (qFold && foldKey(name).includes(qFold)) return true;
                    if (c.phones.some(p => p.includes(q))) return true;
                    // Digits only, so "98220 12345" matches a stored "9822012345".
                    if (qDigits.length >= 4 &&
                        c.phones.some(p => String(p).replace(/[^0-9]/g, '').includes(qDigits))) return true;
                    if (c.emails.some(e => e.toLowerCase().includes(q))) return true;
                    if (c.notes && c.notes.toLowerCase().includes(q)) return true;
                    return false;
                });
            });
        }

        return visitors;
    }

    /**
     * Create new visitor
     */
    create(visitorData) {
        // Get machine info
        const machineInfo = ActivationManager.getMachineInfo();

        // Create visitor instance
        const visitor = new Visitor({
            ...visitorData,
            createdBy: machineInfo.machineId,
            updatedBy: machineInfo.machineId,
            createdAt: getCurrentDate(),
            updatedAt: getCurrentDate()
        });

        // Validate
        const validation = validateVisitor(visitor);
        if (!validation.valid) {
            throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }

        // Save
        const success = StateManager.addVisitor(visitor.toJSON());

        if (!success) {
            throw new Error('Failed to save visitor');
        }

        return visitor;
    }

    /**
     * Update visitor
     */
    update(id, updates) {
        const existing = this.getById(id);

        if (!existing) {
            throw new Error(`Visitor not found: ${id}`);
        }

        // Get machine info
        const machineInfo = ActivationManager.getMachineInfo();

        // Merge updates
        const updated = {
            ...existing,
            ...updates,
            id: existing.id, // Preserve ID
            createdAt: existing.createdAt, // Preserve creation time
            createdBy: existing.createdBy, // Preserve creator
            updatedBy: machineInfo.machineId,
            updatedAt: getCurrentDate()
        };

        // Create visitor instance for validation
        const visitor = new Visitor(updated);

        // Validate
        const validation = validateVisitor(visitor);
        if (!validation.valid) {
            throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }

        // Save
        const success = StateManager.updateVisitor(id, visitor.toJSON());

        if (!success) {
            throw new Error('Failed to update visitor');
        }

        return visitor;
    }

    /**
     * Delete visitor (soft delete)
     */
    delete(id) {
        const visitor = this.getById(id);

        if (!visitor) {
            throw new Error(`Visitor not found: ${id}`);
        }

        const success = StateManager.deleteVisitor(id);

        if (!success) {
            throw new Error('Failed to delete visitor');
        }

        return true;
    }

    /**
     * Add contact to visitor
     */
    addContact(visitorId, contactData) {
        const visitor = this.getById(visitorId);

        if (!visitor) {
            throw new Error(`Visitor not found: ${visitorId}`);
        }

        // Create contact
        const contact = new Contact({
            ...contactData,
            visitorId
        });

        // Add to visitor
        const updatedContacts = [...visitor.contacts, contact.toJSON()];

        // Update visitor
        return this.update(visitorId, { contacts: updatedContacts });
    }

    /**
     * Update contact
     */
    updateContact(visitorId, contactId, updates) {
        const visitor = this.getById(visitorId);

        if (!visitor) {
            throw new Error(`Visitor not found: ${visitorId}`);
        }

        const contactIndex = visitor.contacts.findIndex(c => c.id === contactId);

        if (contactIndex === -1) {
            throw new Error(`Contact not found: ${contactId}`);
        }

        // Update contact
        const updatedContacts = [...visitor.contacts];
        updatedContacts[contactIndex] = {
            ...updatedContacts[contactIndex],
            ...updates,
            id: contactId, // Preserve ID
            visitorId, // Preserve visitor ID
            updatedAt: getCurrentDate()
        };

        // Update visitor
        return this.update(visitorId, { contacts: updatedContacts });
    }

    /**
     * Remove contact (cannot remove SELF)
     */
    removeContact(visitorId, contactId) {
        const visitor = this.getById(visitorId);

        if (!visitor) {
            throw new Error(`Visitor not found: ${visitorId}`);
        }

        const contact = visitor.contacts.find(c => c.id === contactId);

        if (!contact) {
            throw new Error(`Contact not found: ${contactId}`);
        }

        if (contact.relationType === 'SELF') {
            throw new Error('Cannot remove SELF contact');
        }

        // Remove contact
        const updatedContacts = visitor.contacts.filter(c => c.id !== contactId);

        // Update visitor
        return this.update(visitorId, { contacts: updatedContacts });
    }

    /**
     * Get all categories
     */
    getCategories() {
        const visitors = this.getAll();
        const categories = new Set();

        visitors.forEach(v => {
            if (v.category) {
                categories.add(v.category);
            }
        });

        return Array.from(categories).sort();
    }

    /**
     * Get all tags
     */
    getTags() {
        const visitors = this.getAll();
        const tags = new Set();

        visitors.forEach(v => {
            v.tags.forEach(tag => tags.add(tag));
        });

        return Array.from(tags).sort();
    }

    /**
     * Get visitor count
     */
    getCount(includeDeleted = false) {
        return this.getAll(includeDeleted).length;
    }

    /**
     * Get statistics
     */
    getStats() {
        const all = StateManager.getVisitors();
        const active = all.filter(v => v.status === 'active' && !v.deletedAt);
        const deleted = all.filter(v => v.deletedAt);

        return {
            total: all.length,
            active: active.length,
            deleted: deleted.length,
            categories: this.getCategories().length,
            tags: this.getTags().length
        };
    }
}

// Export singleton instance
export default new VisitorService();
