// Event Bus - Simple pub/sub system for app-wide events

class EventBus {
    constructor() {
        this.listeners = new Map();
    }

    /**
     * Subscribe to an event
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }

        this.listeners.get(event).push(callback);

        // Return unsubscribe function
        return () => this.off(event, callback);
    }

    /**
     * Unsubscribe from an event
     */
    off(event, callback) {
        if (!this.listeners.has(event)) return;

        const callbacks = this.listeners.get(event);
        const index = callbacks.indexOf(callback);

        if (index > -1) {
            callbacks.splice(index, 1);
        }
    }

    /**
     * Emit an event
     */
    emit(event, data = null) {
        if (!this.listeners.has(event)) return;

        const callbacks = this.listeners.get(event);
        callbacks.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error in event listener for "${event}":`, error);
            }
        });
    }

    /**
     * Subscribe to event once (auto-unsubscribe after first call)
     */
    once(event, callback) {
        const wrappedCallback = (data) => {
            callback(data);
            this.off(event, wrappedCallback);
        };

        this.on(event, wrappedCallback);
    }

    /**
     * Clear all listeners for an event
     */
    clear(event) {
        if (event) {
            this.listeners.delete(event);
        } else {
            this.listeners.clear();
        }
    }

    /**
     * Get listener count for an event
     */
    listenerCount(event) {
        return this.listeners.get(event)?.length || 0;
    }
}

// Export singleton instance
export default new EventBus();

// Event names (for reference and autocomplete)
export const EVENTS = {
    // State events
    STATE_LOADED: 'state:loaded',
    STATE_CHANGED: 'state:changed',
    STATE_SAVED: 'state:saved',

    // Visitor events
    VISITOR_ADDED: 'visitor:added',
    VISITOR_UPDATED: 'visitor:updated',
    VISITOR_DELETED: 'visitor:deleted',

    // Reminder events
    REMINDER_ACTION_CREATED: 'reminder:action_created',
    REMINDERS_UPDATED: 'reminders:updated',

    // Interaction events
    INTERACTION_ADDED: 'interaction:added',

    // Sync events
    IMPORT_STARTED: 'sync:import_started',
    IMPORT_COMPLETED: 'sync:import_completed',
    IMPORT_FAILED: 'sync:import_failed',
    EXPORT_COMPLETED: 'sync:export_completed',

    // Activation events
    ACTIVATION_SUCCESS: 'activation:success',
    ACTIVATION_FAILED: 'activation:failed',

    // UI events
    ROUTE_CHANGED: 'route:changed',
    MODAL_OPENED: 'modal:opened',
    MODAL_CLOSED: 'modal:closed',
    TOAST_SHOW: 'toast:show'
};
