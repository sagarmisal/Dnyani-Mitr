// Search Service - Advanced search and filtering

import { debounce } from '../utils/helpers.js';

class SearchService {
    constructor() {
        this.searchHistory = [];
        this.maxHistorySize = 10;
    }

    /**
     * Search with debouncing
     */
    searchDebounced(query, searchFn, delay = 300) {
        return debounce(searchFn, delay)(query);
    }

    /**
     * Paginate results
     */
    paginate(items, page = 1, pageSize = 50) {
        const total = items.length;
        const totalPages = Math.ceil(total / pageSize);
        const start = (page - 1) * pageSize;
        const end = start + pageSize;

        return {
            page,
            pageSize,
            total,
            totalPages,
            items: items.slice(start, end),
            hasNext: page < totalPages,
            hasPrev: page > 1
        };
    }

    /**
     * Sort items
     */
    sort(items, field, order = 'asc') {
        return [...items].sort((a, b) => {
            let aVal = this.getNestedValue(a, field);
            let bVal = this.getNestedValue(b, field);

            // Handle null/undefined
            if (aVal == null && bVal == null) return 0;
            if (aVal == null) return order === 'asc' ? 1 : -1;
            if (bVal == null) return order === 'asc' ? -1 : 1;

            // String comparison
            if (typeof aVal === 'string') aVal = aVal.toLowerCase();
            if (typeof bVal === 'string') bVal = bVal.toLowerCase();

            if (aVal < bVal) return order === 'asc' ? -1 : 1;
            if (aVal > bVal) return order === 'asc' ? 1 : -1;
            return 0;
        });
    }

    /**
     * Get nested value from object (e.g., "contacts[0].name")
     */
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            // Handle array access like "contacts[0]"
            const arrayMatch = key.match(/(\w+)\[(\d+)\]/);
            if (arrayMatch) {
                const [, arrayKey, index] = arrayMatch;
                return current?.[arrayKey]?.[parseInt(index)];
            }
            return current?.[key];
        }, obj);
    }

    /**
     * Filter items by multiple criteria
     */
    filter(items, criteria) {
        return items.filter(item => {
            return Object.entries(criteria).every(([key, value]) => {
                if (value === null || value === undefined || value === '') return true;

                const itemValue = this.getNestedValue(item, key);

                // Array contains check
                if (Array.isArray(itemValue)) {
                    return itemValue.includes(value);
                }

                // Exact match
                return itemValue === value;
            });
        });
    }

    /**
     * Add to search history
     */
    addToHistory(query) {
        if (!query || !query.trim()) return;

        // Remove duplicates
        this.searchHistory = this.searchHistory.filter(q => q !== query);

        // Add to front
        this.searchHistory.unshift(query);

        // Limit size
        if (this.searchHistory.length > this.maxHistorySize) {
            this.searchHistory = this.searchHistory.slice(0, this.maxHistorySize);
        }
    }

    /**
     * Get search history
     */
    getHistory() {
        return [...this.searchHistory];
    }

    /**
     * Clear search history
     */
    clearHistory() {
        this.searchHistory = [];
    }

    /**
     * Highlight search terms in text
     */
    highlight(text, query) {
        if (!text || !query) return text;

        const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }

    /**
     * Escape regex special characters
     */
    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}

// Export singleton instance
export default new SearchService();
