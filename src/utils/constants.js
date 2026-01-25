// Application Constants

export const APP_VERSION = '2.0.0';
export const APP_NAME = 'NGO Visitor & Reminder Manager';
export const ORGANIZATION = 'Sewa Sankalp Pratishthan';
export const ORGANIZATION_URL = 'https://sewasankalp.org/';

// Relationship Types (Fixed)
export const RELATIONSHIP_TYPES = {
    SELF: 'SELF',
    SPOUSE: 'SPOUSE',
    CHILD: 'CHILD',
    PARENT: 'PARENT',
    FRIEND: 'FRIEND'
};

export const RELATIONSHIP_LABELS = {
    [RELATIONSHIP_TYPES.SELF]: '👤 Self',
    [RELATIONSHIP_TYPES.SPOUSE]: '💑 Spouse',
    [RELATIONSHIP_TYPES.CHILD]: '👶 Child',
    [RELATIONSHIP_TYPES.PARENT]: '👴 Parent',
    [RELATIONSHIP_TYPES.FRIEND]: '🤝 Friend'
};

// Event Types
export const EVENT_TYPES = {
    BIRTHDAY: 'Birthday',
    ANNIVERSARY: 'Anniversary',
    DEATH: 'Death',
    CUSTOM: 'Custom'
};

// Reminder Actions
export const REMINDER_ACTIONS = {
    CONTACTED: 'contacted',
    MISSED: 'missed',
    SNOOZED: 'snoozed',
    COMPLETED: 'completed'
};

// Interaction Types
export const INTERACTION_TYPES = {
    CALL: 'call',
    VISIT: 'visit',
    EMAIL: 'email',
    LETTER: 'letter',
    OTHER: 'other'
};

export const INTERACTION_TYPE_LABELS = {
    [INTERACTION_TYPES.CALL]: '📞 Phone Call',
    [INTERACTION_TYPES.VISIT]: '🏠 Visit',
    [INTERACTION_TYPES.EMAIL]: '📧 Email',
    [INTERACTION_TYPES.LETTER]: '✉️ Letter',
    [INTERACTION_TYPES.OTHER]: '📝 Other'
};

// Machine Roles
export const MACHINE_ROLES = {
    ROOT: 'root',
    SATELLITE: 'satellite'
};

// Storage Keys
export const STORAGE_KEYS = {
    APP_STATE: 'NGOApp_v2_State',
    ACTIVATION: 'NGOApp_v2_Activation'
};

// Settings Defaults
export const DEFAULT_SETTINGS = {
    reminderLookahead: 7, // days
    autoBackupDays: 7,
    theme: 'light',
    language: 'en'
};

// Visitor Categories (Predefined, but users can add custom)
export const DEFAULT_CATEGORIES = [
    'Regular',
    'Special',
    'Donor',
    'Volunteer',
    'Beneficiary'
];

// Pagination
export const DEFAULT_PAGE_SIZE = 50;

// Date Formats
export const DATE_FORMAT = 'YYYY-MM-DD';
export const DISPLAY_DATE_FORMAT = 'MMM DD, YYYY';

// Validation Rules
export const VALIDATION = {
    MIN_NAME_LENGTH: 2,
    MAX_NAME_LENGTH: 100,
    MAX_NOTES_LENGTH: 5000,
    PHONE_PATTERN: /^[\d\s\-\+\(\)]+$/,
    EMAIL_PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
};

// Master Key Format
export const MASTER_KEY_FORMAT = /^SSP-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

// For development/testing only
export const DEV_MASTER_KEY = 'SSP-DEV1-2026-TEST';
