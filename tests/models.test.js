import { describe, it, expect, vi } from 'vitest';

// Mock the imports that models depend on
vi.mock('../src/utils/helpers.js', () => ({
  generateId: (prefix) => `${prefix}_test_${Math.random().toString(36).slice(2, 8)}`
}));

vi.mock('../src/utils/formatters.js', () => ({
  getCurrentDate: () => '2026-04-01T10:00:00.000Z'
}));

vi.mock('../src/utils/constants.js', () => ({
  INTERACTION_TYPES: { CALL: 'call', WHATSAPP: 'whatsapp' },
  RELATIONSHIP_TYPES: { SELF: 'SELF', SPOUSE: 'SPOUSE' }
}));

describe('Interaction model', () => {
  let Interaction;

  beforeAll(async () => {
    const mod = await import('../src/models/Interaction.js');
    Interaction = mod.Interaction;
  });

  it('sets default values for new interaction', () => {
    const i = new Interaction({ visitorId: 'v1', interactionType: 'call' });
    expect(i.visitorId).toBe('v1');
    expect(i.interactionType).toBe('call');
    expect(i.outcome).toBeNull();
    expect(i.duration).toBeNull();
    expect(i.followUpDate).toBeNull();
    expect(i.followUpNotes).toBe('');
    expect(i.id).toMatch(/^interaction_/);
  });

  it('preserves duration: 0 (not falsy-dropped)', () => {
    const i = new Interaction({ visitorId: 'v1', interactionType: 'call', duration: 0 });
    expect(i.duration).toBe(0);
  });

  it('converts duration string to number', () => {
    const i = new Interaction({ visitorId: 'v1', interactionType: 'call', duration: '15' });
    expect(i.duration).toBe(15);
  });

  it('handles null duration correctly', () => {
    const i = new Interaction({ visitorId: 'v1', interactionType: 'call', duration: null });
    expect(i.duration).toBeNull();
  });

  it('handles empty string duration as null', () => {
    const i = new Interaction({ visitorId: 'v1', interactionType: 'call', duration: '' });
    expect(i.duration).toBeNull();
  });

  it('toJSON includes all v3 fields', () => {
    const i = new Interaction({
      visitorId: 'v1',
      interactionType: 'whatsapp',
      outcome: 'successful',
      duration: 5,
      followUpDate: '2026-04-10',
      followUpNotes: 'Call back'
    });
    const json = i.toJSON();
    expect(json.outcome).toBe('successful');
    expect(json.duration).toBe(5);
    expect(json.followUpDate).toBe('2026-04-10');
    expect(json.followUpNotes).toBe('Call back');
  });

  it('fromJSON roundtrips correctly', () => {
    const data = {
      id: 'interaction_123',
      visitorId: 'v1',
      interactionType: 'whatsapp',
      outcome: 'no_answer',
      duration: 0,
      followUpDate: '2026-04-10',
      followUpNotes: 'Try again'
    };
    const i = Interaction.fromJSON(data);
    expect(i.id).toBe('interaction_123');
    expect(i.outcome).toBe('no_answer');
    expect(i.duration).toBe(0);
  });
});

describe('Visitor model', () => {
  let Visitor;

  beforeAll(async () => {
    const mod = await import('../src/models/Visitor.js');
    Visitor = mod.Visitor;
  });

  it('sets v3 default values', () => {
    const v = new Visitor({});
    expect(v.consentGiven).toBe(false);
    expect(v.consentDate).toBeNull();
    expect(v.doNotContact).toBe(false);
    expect(v.contactFrequencyDays).toBeNull();
    expect(v.engagementScore).toBe(0);
    expect(v.engagementUpdatedAt).toBeNull();
  });

  it('preserves v3 fields when provided', () => {
    const v = new Visitor({
      consentGiven: true,
      consentDate: '2026-04-01T00:00:00Z',
      doNotContact: true,
      contactFrequencyDays: 30,
      engagementScore: 75
    });
    expect(v.consentGiven).toBe(true);
    expect(v.doNotContact).toBe(true);
    expect(v.contactFrequencyDays).toBe(30);
    expect(v.engagementScore).toBe(75);
  });

  it('toJSON includes all v3 fields', () => {
    const v = new Visitor({ consentGiven: true, doNotContact: false });
    const json = v.toJSON();
    expect(json).toHaveProperty('consentGiven', true);
    expect(json).toHaveProperty('doNotContact', false);
    expect(json).toHaveProperty('contactFrequencyDays', null);
    expect(json).toHaveProperty('engagementScore', 0);
    expect(json).toHaveProperty('engagementUpdatedAt', null);
  });
});
