// Simple Hash-based Router

import EventBus, { EVENTS } from './events.js';

class Router {
    constructor() {
        this.routes = new Map();
        this.currentRoute = null;
        this.defaultRoute = '/';

        // Listen to hash changes
        window.addEventListener('hashchange', () => this.handleRouteChange());
        window.addEventListener('load', () => this.handleRouteChange());
    }

    /**
     * Register a route
     */
    register(path, handler) {
        this.routes.set(path, handler);
    }

    /**
     * Navigate to a route
     */
    navigate(path) {
        window.location.hash = path;
    }

    /**
     * Handle route change
     */
    handleRouteChange() {
        const hash = window.location.hash.slice(1) || this.defaultRoute;

        // Parse route and params
        const [path, queryString] = hash.split('?');
        const params = this.parseQueryString(queryString);

        // Find matching route
        const handler = this.routes.get(path);

        if (handler) {
            this.currentRoute = path;

            try {
                handler(params);
                EventBus.emit(EVENTS.ROUTE_CHANGED, { path, params });
            } catch (error) {
                console.error('Error handling route:', error);
                this.navigate(this.defaultRoute);
            }
        } else {
            console.warn('Route not found:', path);
            this.navigate(this.defaultRoute);
        }
    }

    /**
     * Parse query string to object
     */
    parseQueryString(queryString) {
        if (!queryString) return {};

        const params = {};
        const pairs = queryString.split('&');

        pairs.forEach(pair => {
            const [key, value] = pair.split('=');
            params[decodeURIComponent(key)] = decodeURIComponent(value || '');
        });

        return params;
    }

    /**
     * Get current route
     */
    getCurrentRoute() {
        return this.currentRoute;
    }

    /**
     * Set default route
     */
    setDefaultRoute(path) {
        this.defaultRoute = path;
    }
}

// Export singleton instance
export default new Router();

// Route paths (for reference)
export const ROUTES = {
    ACTIVATION: '/activation',
    CALENDAR: '/calendar',
    DASHBOARD: '/dashboard',
    VISITORS: '/visitors',
    VISITOR_VIEW: '/visitor/view',
    VISITOR_ADD: '/visitor/add',
    VISITOR_EDIT: '/visitor/edit',
    REMINDERS: '/reminders',
    CAMPAIGNS: '/campaigns',
    INTERACTIONS: '/interactions',
    SYNC: '/sync',
    BACKUP: '/backup',
    SETTINGS: '/settings',
    ABOUT: '/about'
};
