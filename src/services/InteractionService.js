// Interaction Service - Track visitor interactions

import StateManager from '../core/state.js';
import { Interaction } from '../models/Interaction.js';
import { getCurrentDate } from '../utils/formatters.js';
import ActivationManager from '../core/activation.js';
import EventBus, { EVENTS } from '../core/events.js';

class InteractionService {
    /**
     * Log an interaction
     * @param {Object} params - Interaction parameters
     * @param {string} params.visitorId - Required visitor ID
     * @param {string} params.interactionType - Type of interaction
     * @param {string} [params.notes] - Optional notes
     * @param {string} [params.contactId] - Optional contact ID
     * @param {string} [params.interactionDate] - Optional date (defaults to now)
     * @param {string} [params.outcome] - Optional outcome
     * @param {number} [params.duration] - Optional duration in minutes
     * @param {string} [params.followUpDate] - Optional follow-up date
     * @param {string} [params.followUpNotes] - Optional follow-up notes
     */
    log(visitorIdOrParams, interactionType, notes, contactId = null, interactionDate = null) {
        const machineInfo = ActivationManager.getMachineInfo();

        // Support both old positional args and new object-based args
        let params;
        if (typeof visitorIdOrParams === 'object' && visitorIdOrParams !== null) {
            params = visitorIdOrParams;
        } else {
            params = { visitorId: visitorIdOrParams, interactionType, notes, contactId, interactionDate };
        }

        // Iter 11 (A8): visitorId has always been documented as required, but was
        // never enforced. A null one produced an orphan interaction that renders as
        // "Unknown Visitor" with a dead link in History and then syncs to every
        // machine. Fail loudly instead — all callers already pass a real id, and a
        // scheduled item with no visitor must not log at all (plan G3).
        if (!params.visitorId) {
            throw new Error('Cannot log an interaction without a visitorId');
        }

        const interaction = new Interaction({
            visitorId: params.visitorId,
            contactId: params.contactId || null,
            interactionType: params.interactionType,
            notes: params.notes || '',
            interactionDate: params.interactionDate || getCurrentDate(),
            createdBy: machineInfo?.machineId || null,
            outcome: params.outcome || null,
            duration: (params.duration != null && params.duration !== '') ? Number(params.duration) : null,
            followUpDate: params.followUpDate || null,
            followUpNotes: params.followUpNotes || ''
        });

        const success = StateManager.addInteraction(interaction.toJSON());

        if (!success) {
            throw new Error('Failed to log interaction');
        }

        return interaction;
    }

    /**
     * Get interactions for a visitor
     */
    getForVisitor(visitorId) {
        const interactions = StateManager.getInteractions();
        return interactions
            .filter(i => i.visitorId === visitorId)
            .sort((a, b) => new Date(b.interactionDate) - new Date(a.interactionDate));
    }

    /**
     * Get recent interactions
     */
    getRecent(limit = 10) {
        const interactions = StateManager.getInteractions();
        return interactions
            .sort((a, b) => new Date(b.interactionDate) - new Date(a.interactionDate))
            .slice(0, limit);
    }

    /**
     * Get interaction statistics
     */
    getStats() {
        const interactions = StateManager.getInteractions();

        const byType = {};
        interactions.forEach(i => {
            byType[i.interactionType] = (byType[i.interactionType] || 0) + 1;
        });

        return {
            total: interactions.length,
            byType
        };
    }
}

// Export singleton instance
export default new InteractionService();
