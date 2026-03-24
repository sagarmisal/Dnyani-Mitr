// Sync Service - Logic for merging and reconciling data between machines

import StateManager from '../core/state.js';
import VisitorService from './VisitorService.js';
import EventBus, { EVENTS } from '../core/events.js';

class SyncService {
    /**
     * Merge incoming data package into local state
     */
    merge(packageData) {
        if (!packageData || !packageData.visitors) {
            throw new Error('Invalid sync package: No visitor data found');
        }

        // Validate that visitors is an array
        if (!Array.isArray(packageData.visitors)) {
            throw new Error('Invalid sync package: visitors must be an array');
        }

        const currentState = StateManager.getState();
        const incomingVisitors = packageData.visitors;
        const incomingInteractions = packageData.interactions || [];
        const incomingActions = packageData.reminderActions || [];

        // 1. Merge Visitors
        const visitorMap = new Map();
        currentState.visitors.forEach(v => visitorMap.set(v.id, v));

        let updatedCount = 0;
        let addedCount = 0;
        let skippedCount = 0;

        incomingVisitors.forEach(incoming => {
            // Basic validation: must have id and contacts array
            if (!incoming || !incoming.id || !Array.isArray(incoming.contacts)) {
                skippedCount++;
                return;
            }

            if (visitorMap.has(incoming.id)) {
                const existing = visitorMap.get(incoming.id);

                // Respect soft deletes: if local is deleted and incoming is older, keep deleted
                if (existing.status === 'deleted' && incoming.status !== 'deleted') {
                    if (new Date(existing.deletedAt) > new Date(incoming.updatedAt)) {
                        return; // Local delete is newer, skip incoming
                    }
                }

                // Keep the one with the latest updatedAt
                if (new Date(incoming.updatedAt) > new Date(existing.updatedAt)) {
                    visitorMap.set(incoming.id, incoming);
                    updatedCount++;
                }
            } else {
                visitorMap.set(incoming.id, incoming);
                addedCount++;
            }
        });

        // 2. Merge Interactions (avoid duplicates by ID)
        const interactionIds = new Set(currentState.interactions.map(i => i.id));
        const mergedInteractions = [...currentState.interactions];

        incomingInteractions.forEach(i => {
            if (i && i.id && i.visitorId && i.interactionType && !interactionIds.has(i.id)) {
                mergedInteractions.push(i);
            }
        });

        // 3. Merge Reminder Actions
        const actionIds = new Set(currentState.reminderActions.map(a => a.id));
        const mergedActions = [...currentState.reminderActions];

        incomingActions.forEach(a => {
            if (a && a.id && !actionIds.has(a.id)) {
                mergedActions.push(a);
            }
        });

        // 4. Save updated state
        StateManager.setState({
            visitors: Array.from(visitorMap.values()),
            interactions: mergedInteractions,
            reminderActions: mergedActions
        });

        EventBus.emit(EVENTS.IMPORT_COMPLETED);

        return {
            visitorsAdded: addedCount,
            visitorsUpdated: updatedCount,
            visitorsSkipped: skippedCount,
            interactionsAdded: mergedInteractions.length - currentState.interactions.length,
            actionsAdded: mergedActions.length - currentState.reminderActions.length
        };
    }

    /**
     * Prepare an export package
     */
    prepareExport() {
        const state = StateManager.getState();
        const machine = StateManager.getSettings().machine || {};

        return {
            metadata: {
                exportedAt: new Date().toISOString(),
                machineId: machine.machineId,
                machineName: machine.machineName,
                machineRole: machine.machineRole
            },
            data: {
                visitors: state.visitors,
                interactions: state.interactions,
                reminderActions: state.reminderActions
            }
        };
    }
}

export default new SyncService();
