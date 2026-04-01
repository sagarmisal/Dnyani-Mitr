import { describe, it, expect } from 'vitest';
import {
  APP_VERSION,
  INTERACTION_TYPES,
  INTERACTION_TYPE_LABELS,
  INTERACTION_OUTCOMES,
  INTERACTION_OUTCOME_LABELS,
  DEFAULT_MESSAGE_TEMPLATES,
  DEFAULT_SETTINGS,
  ORGANIZATION
} from '../src/utils/constants.js';

describe('APP_VERSION', () => {
  it('is 3.0.0', () => {
    expect(APP_VERSION).toBe('3.0.0');
  });
});

describe('INTERACTION_TYPES', () => {
  it('has all 9 types', () => {
    const expected = ['call', 'visit', 'email', 'letter', 'whatsapp', 'sms', 'meeting', 'donation', 'other'];
    expect(Object.values(INTERACTION_TYPES)).toEqual(expect.arrayContaining(expected));
    expect(Object.values(INTERACTION_TYPES)).toHaveLength(9);
  });

  it('has labels for every type', () => {
    Object.values(INTERACTION_TYPES).forEach(type => {
      expect(INTERACTION_TYPE_LABELS[type]).toBeDefined();
      expect(INTERACTION_TYPE_LABELS[type].length).toBeGreaterThan(0);
    });
  });
});

describe('INTERACTION_OUTCOMES', () => {
  it('has all 6 outcomes', () => {
    const expected = ['successful', 'no_answer', 'busy', 'rescheduled', 'left_message', 'other'];
    expect(Object.values(INTERACTION_OUTCOMES)).toEqual(expect.arrayContaining(expected));
    expect(Object.values(INTERACTION_OUTCOMES)).toHaveLength(6);
  });

  it('has labels for every outcome', () => {
    Object.values(INTERACTION_OUTCOMES).forEach(outcome => {
      expect(INTERACTION_OUTCOME_LABELS[outcome]).toBeDefined();
    });
  });
});

describe('DEFAULT_MESSAGE_TEMPLATES', () => {
  it('has all 5 template keys', () => {
    expect(DEFAULT_MESSAGE_TEMPLATES).toHaveProperty('birthday');
    expect(DEFAULT_MESSAGE_TEMPLATES).toHaveProperty('anniversary');
    expect(DEFAULT_MESSAGE_TEMPLATES).toHaveProperty('deathAnniversary');
    expect(DEFAULT_MESSAGE_TEMPLATES).toHaveProperty('followUp');
    expect(DEFAULT_MESSAGE_TEMPLATES).toHaveProperty('thankYou');
  });

  it('all templates use {name} variable', () => {
    Object.values(DEFAULT_MESSAGE_TEMPLATES).forEach(tpl => {
      expect(tpl).toContain('{name}');
    });
  });

  it('all templates use {org} variable (not hardcoded org name)', () => {
    Object.values(DEFAULT_MESSAGE_TEMPLATES).forEach(tpl => {
      expect(tpl).toContain('{org}');
      // Should NOT contain the hardcoded org name in the template itself
      expect(tpl).not.toContain('Sewa Sankalp Pratishthan');
    });
  });

  it('followUp template uses {volunteer} variable', () => {
    expect(DEFAULT_MESSAGE_TEMPLATES.followUp).toContain('{volunteer}');
  });
});

describe('DEFAULT_SETTINGS', () => {
  it('includes organizationName defaulting to ORGANIZATION constant', () => {
    expect(DEFAULT_SETTINGS.organizationName).toBe(ORGANIZATION);
  });

  it('includes lapseThresholdDays', () => {
    expect(DEFAULT_SETTINGS.lapseThresholdDays).toBe(60);
  });

  it('includes messageTemplates', () => {
    expect(DEFAULT_SETTINGS.messageTemplates).toBeDefined();
    expect(DEFAULT_SETTINGS.messageTemplates.birthday).toContain('{name}');
  });
});
