// Application Constants

export const APP_VERSION = '3.1.0';
export const APP_NAME = 'Dnyani Mitr';
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
// Tokens (substituted at send time): {name} {org} {volunteer} {occasion} {tagline}
export const DEFAULT_MESSAGE_TEMPLATES = {
    birthday: "Happy Birthday {name}! Warm wishes from {org}. 🎂",
    anniversary: "Happy Anniversary {name}! Wishing you many more years together. 💍 — {org}",
    deathAnniversary: "Remembering your loved one today, {name}. Our thoughts are with you. 🙏 — {org}",
    followUp: "Hi {name}, following up on our last conversation. How can we help? — {volunteer}, {org}",
    thankYou: "Thank you {name} for your generous support of {org}! 🙏"
};

// ─── Iteration 10: Occasion Campaigns ───────────────────────────────────────

// Org sign-off tagline (Marathi). Editable in Settings → settings.taglineMr.
export const DEFAULT_TAGLINE_MR = 'चला जरा वेगळे जगुया ...';

// Campaign channels & lifecycle status
export const CAMPAIGN_CHANNELS = { SMS: 'sms', WHATSAPP: 'whatsapp', BOTH: 'both' };
export const CAMPAIGN_STATUS = {
    DRAFT: 'draft',
    SENDING: 'sending',
    SENT: 'sent',
    PARTIAL: 'partial',
    CANCELLED: 'cancelled'
};

// Generic greeting/invitation templates — used for custom occasions or no-occasion campaigns.
// Same token set as above. {occasion} resolves to the occasion's name in the campaign language.
export const DEFAULT_CAMPAIGN_TEMPLATES = {
    greeting: {
        en: "Dear {name}, warm greetings from {org}! 🙏\n{tagline}",
        mr: "{name} जी, {org} तर्फे हार्दिक शुभेच्छा! 🙏\n{tagline}"
    },
    invitation: {
        en: "Dear {name}, {org} cordially invites you. Your presence is requested. 🙏\n{tagline}",
        mr: "{name} जी, {org} तर्फे आयोजित कार्यक्रमास आपणास सादर निमंत्रण. कृपया उपस्थित रहावे. 🙏\n{tagline}"
    }
};

// Seeded fixed-Gregorian-date occasions (builtin:true). Users add their own (e.g. the
// Foundation Day, or movable festivals each year) via the Occasion Manager. Each occasion
// owns bilingual greeting + invitation templates. createdAt/updatedAt are null for built-ins.
export const DEFAULT_OCCASIONS = [
    {
        id: 'occasion_new_year', name: 'New Year', nameMr: 'नववर्ष', month: 1, day: 1, builtin: true,
        templates: {
            greeting: { en: "Happy New Year, {name}! 🎉 Warm wishes from {org}.\n{tagline}", mr: "{name} जी, नववर्षाच्या हार्दिक शुभेच्छा! 🎉 — {org}\n{tagline}" },
            invitation: { en: "Dear {name}, {org} invites you to our New Year programme. 🙏\n{tagline}", mr: "{name} जी, {org} तर्फे नववर्ष कार्यक्रमास सादर निमंत्रण. 🙏\n{tagline}" }
        },
        createdAt: null, updatedAt: null
    },
    {
        id: 'occasion_republic_day', name: 'Republic Day', nameMr: 'प्रजासत्ताक दिन', month: 1, day: 26, builtin: true,
        templates: {
            greeting: { en: "Happy Republic Day, {name}! 🇮🇳 Warm wishes from {org}.\n{tagline}", mr: "{name} जी, प्रजासत्ताक दिनाच्या हार्दिक शुभेच्छा! 🇮🇳 — {org}\n{tagline}" },
            invitation: { en: "Dear {name}, {org} invites you to our Republic Day programme. 🙏\n{tagline}", mr: "{name} जी, प्रजासत्ताक दिनानिमित्त {org} तर्फे कार्यक्रमास सादर निमंत्रण. 🙏\n{tagline}" }
        },
        createdAt: null, updatedAt: null
    },
    {
        id: 'occasion_maharashtra_day', name: 'Maharashtra Day', nameMr: 'महाराष्ट्र दिन', month: 5, day: 1, builtin: true,
        templates: {
            greeting: { en: "Happy Maharashtra Day, {name}! 🚩 — {org}\n{tagline}", mr: "{name} जी, महाराष्ट्र दिनाच्या हार्दिक शुभेच्छा! 🚩 — {org}\n{tagline}" },
            invitation: { en: "Dear {name}, {org} invites you to our Maharashtra Day programme. 🙏\n{tagline}", mr: "{name} जी, महाराष्ट्र दिनानिमित्त {org} तर्फे कार्यक्रमास सादर निमंत्रण. 🙏\n{tagline}" }
        },
        createdAt: null, updatedAt: null
    },
    {
        id: 'occasion_independence_day', name: 'Independence Day', nameMr: 'स्वातंत्र्य दिन', month: 8, day: 15, builtin: true,
        templates: {
            greeting: { en: "Happy Independence Day, {name}! 🇮🇳 — {org}\n{tagline}", mr: "{name} जी, स्वातंत्र्य दिनाच्या हार्दिक शुभेच्छा! 🇮🇳 — {org}\n{tagline}" },
            invitation: { en: "Dear {name}, {org} invites you to our Independence Day programme. 🙏\n{tagline}", mr: "{name} जी, स्वातंत्र्य दिनानिमित्त {org} तर्फे कार्यक्रमास सादर निमंत्रण. 🙏\n{tagline}" }
        },
        createdAt: null, updatedAt: null
    },
    {
        id: 'occasion_gandhi_jayanti', name: 'Gandhi Jayanti', nameMr: 'गांधी जयंती', month: 10, day: 2, builtin: true,
        templates: {
            greeting: { en: "On Gandhi Jayanti, warm wishes, {name}. 🙏 — {org}\n{tagline}", mr: "{name} जी, गांधी जयंतीच्या हार्दिक शुभेच्छा! 🙏 — {org}\n{tagline}" },
            invitation: { en: "Dear {name}, {org} invites you to our Gandhi Jayanti programme. 🙏\n{tagline}", mr: "{name} जी, गांधी जयंतीनिमित्त {org} तर्फे कार्यक्रमास सादर निमंत्रण. 🙏\n{tagline}" }
        },
        createdAt: null, updatedAt: null
    }
];

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
    messageTemplates: { ...DEFAULT_MESSAGE_TEMPLATES },
    // Iter 10 — campaigns + notifications
    taglineMr: DEFAULT_TAGLINE_MR,   // org sign-off appended to campaign messages
    taglineEn: '',
    defaultCampaignLanguage: 'mr',   // 'mr' | 'en'
    notificationsEnabled: false,     // local notification opt-in
    notificationDigestTime: '09:00'  // HH:mm for the daily reminder digest
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
