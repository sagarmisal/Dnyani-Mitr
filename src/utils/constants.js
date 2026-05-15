// Application Constants

export const APP_VERSION = '3.0.5';
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
    WHATSAPP: 'whatsapp',
    SMS: 'sms',
    MEETING: 'meeting',
    DONATION: 'donation',
    OTHER: 'other'
};

export const INTERACTION_TYPE_LABELS = {
    [INTERACTION_TYPES.CALL]: '📞 Call',
    [INTERACTION_TYPES.VISIT]: '🏠 Visit',
    [INTERACTION_TYPES.EMAIL]: '📧 Email',
    [INTERACTION_TYPES.LETTER]: '✉️ Letter',
    [INTERACTION_TYPES.WHATSAPP]: '💬 WhatsApp',
    [INTERACTION_TYPES.SMS]: '📱 SMS',
    [INTERACTION_TYPES.MEETING]: '🤝 Meeting',
    [INTERACTION_TYPES.DONATION]: '🎁 Donation',
    [INTERACTION_TYPES.OTHER]: '📋 Other'
};

// Interaction Outcomes
export const INTERACTION_OUTCOMES = {
    SUCCESSFUL: 'successful',
    NO_ANSWER: 'no_answer',
    BUSY: 'busy',
    RESCHEDULED: 'rescheduled',
    LEFT_MESSAGE: 'left_message',
    OTHER: 'other'
};

export const INTERACTION_OUTCOME_LABELS = {
    [INTERACTION_OUTCOMES.SUCCESSFUL]: 'Successful',
    [INTERACTION_OUTCOMES.NO_ANSWER]: 'No Answer',
    [INTERACTION_OUTCOMES.BUSY]: 'Busy',
    [INTERACTION_OUTCOMES.RESCHEDULED]: 'Rescheduled',
    [INTERACTION_OUTCOMES.LEFT_MESSAGE]: 'Left Message',
    [INTERACTION_OUTCOMES.OTHER]: 'Other'
};

// Machine Roles
export const MACHINE_ROLES = {
    ROOT: 'root',
    SATELLITE: 'satellite'
};

// Storage Keys
export const STORAGE_KEYS = {
    APP_STATE: 'NGOApp_v2_State',
    ACTIVATION: 'NGOApp_v2_Activation',
    PRE_SYNC_BACKUP: 'NGOApp_v2_PreSyncBackup'
};

// Default Message Templates
// Use {name}, {org}, {volunteer} variables — substituted at send time
export const DEFAULT_MESSAGE_TEMPLATES = {
    birthday: "Happy Birthday {name}! Warm wishes from {org}. 🎂",
    anniversary: "Happy Anniversary {name}! Wishing you many more years together. 💍 — {org}",
    deathAnniversary: "Remembering your loved one today, {name}. Our thoughts are with you. 🙏 — {org}",
    followUp: "Hi {name}, following up on our last conversation. How can we help? — {volunteer}, {org}",
    thankYou: "Thank you {name} for your generous support of {org}! 🙏"
};

// Engagement Score Thresholds
export const ENGAGEMENT_THRESHOLDS = {
    HEALTHY: 80,
    ATTENTION: 50,
    AT_RISK: 25
};

// Settings Defaults
export const DEFAULT_SETTINGS = {
    reminderLookahead: 7, // days
    autoBackupDays: 7,
    lapseThresholdDays: 60,
    organizationName: ORGANIZATION, // user-configurable org name for templates
    theme: 'light',
    language: 'en',
    messageTemplates: { ...DEFAULT_MESSAGE_TEMPLATES }
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
