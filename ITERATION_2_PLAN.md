# Iteration 2: Data Sync Redesign — Detailed Implementation Plan

> **Status:** PLANNED — Awaiting approval to implement
> **Created:** 2026-03-24
> **Scope:** Phone-based deduplication, two-tier merge, pre-sync backup, UI fixes
> **Requirements Source:** PROJECT_PLAN.md Section 4

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Business Review](#2-business-review)
3. [Technical Review](#3-technical-review)
4. [Architectural Review](#4-architectural-review)
5. [Implementation Steps](#5-implementation-steps)
6. [File Change Matrix](#6-file-change-matrix)
7. [Risk Assessment](#7-risk-assessment)
8. [Testing Plan](#8-testing-plan)

---

## 1. Executive Summary

**Problem:** When two machines independently create the same visitor (e.g., coordinator adds "Suresh Patil" at office, volunteer adds "Suresh" in the field), the current merge creates duplicates because it only matches by visitor ID.

**Solution:** Add phone-number-based deduplication as a secondary matching tier, with name similarity checking to distinguish same-person-different-spelling from genuinely different people sharing a phone.

**Deliverables:**
- Phone normalization utility
- Two-tier merge algorithm (ID + phone)
- Name similarity check
- Pre-sync auto-backup + restore UI
- Wire "Include Interaction History" checkbox
- Fix satellite warning text + "Sycing" typo
- Enhanced import preview with add/update/skip/duplicate breakdown
- Duplicate flagging in import summary
- Consolidate export logic (SyncManager currently bypasses SyncService.prepareExport)

---

## 2. Business Review

### 2.1 User Stories Addressed

| # | As a... | I want to... | So that... |
|---|---------|-------------|------------|
| 1 | Coordinator | Import volunteer data without creating duplicates | My master list stays clean |
| 2 | Volunteer | Know my import won't corrupt data | I'm confident using the sync feature |
| 3 | Coordinator | See what will change before importing | I can verify the merge is correct |
| 4 | Anyone | Restore my data if sync goes wrong | I have a safety net |
| 5 | Volunteer | Export without interaction history (smaller file) | WhatsApp transfer is faster on 2G |
| 6 | Coordinator | See flagged duplicates after import | I can manually review edge cases |

### 2.2 Real-World Scenario Coverage

**Scenario A — Normal weekly cycle:**
- Coordinator exports Monday, volunteers import → IDs match → Tier 1 handles everything
- Volunteers export Thursday, coordinator imports → IDs match → Tier 1 handles everything
- **No change needed** — this already works. Iteration 2 must not break this.

**Scenario B — Independent creation (the gap):**
- Coordinator adds "Suresh Patil" with phone 9876543210
- Volunteer independently adds "Suresh" with phone 9876543210
- Different visitor IDs → Tier 1 fails → Tier 2 catches by phone
- Names similar ("Suresh" contained in "Suresh Patil") → auto-merge
- **This is the primary fix.**

**Scenario C — Family sharing phone (edge case):**
- Husband "Ramesh" has phone 9876543210
- Wife "Sunita" also registered with same phone 9876543210
- Phone matches but names differ → flag as duplicate, add both
- Coordinator reviews manually later
- **Must not auto-merge different people.**

**Scenario D — Accidental data corruption:**
- Volunteer imports wrong file, overwrites good data
- Pre-sync backup → can restore via UI
- **Safety net — critical for user trust.**

### 2.3 Business Constraints

- No internet required (offline-first)
- JSON files shared via WhatsApp (size matters — interaction history toggle)
- Users are non-technical (NGO volunteers on cheap Android phones)
- Error messages must be clear and actionable
- UI must work on small screens (360px width)

---

## 3. Technical Review

### 3.1 Current State Analysis

**SyncService.merge() — Lines 11-98:**
- Only uses ID-based matching (Map keyed by visitor.id)
- Returns: `{visitorsAdded, visitorsUpdated, visitorsSkipped, interactionsAdded, actionsAdded}`
- Missing: phone index, phone matching, name similarity, duplicate flags, backup

**SyncManager export handler — Lines 136-158:**
- Builds export inline (bypasses SyncService.prepareExport)
- "Include Interaction History" checkbox exists (line 48) but is NOT checked in export
- Always includes interactions, reminderActions, settings in export

**SyncManager import preview — Lines 265-284:**
- Only shows total counts (visitors, interactions)
- No breakdown of add/update/skip/duplicate
- No backup indicator

**Phone storage:**
- Contact.phones = array of raw strings (Contact.js line 13)
- No normalization anywhere in the pipeline
- formatPhone() in formatters.js just trims (line 138-142)

**Storage keys:**
- `NGOApp_v2_State` — main state
- `NGOApp_v2_Activation` — activation data
- `NGOApp_v2_PreSyncBackup` — NEW (not yet used, defined in PROJECT_PLAN.md Section 4.4)

### 3.2 New Functions Required

#### 3.2.1 `normalizePhone(phone)` — New in formatters.js

```javascript
/**
 * Normalize phone number for dedup matching.
 * Strips non-digits, takes last 10 digits.
 * Returns null if result is less than 10 digits.
 */
export function normalizePhone(phone) {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) return null;
    return digits.slice(-10);
}
```

**Why last 10:** Indian mobile numbers are 10 digits. Country code (+91) and leading 0 are stripped. This handles all input formats: "+91 98765-43210", "098765 43210", "9876543210".

**Why null for < 10:** Short numbers (landlines, extensions) are unreliable for matching.

#### 3.2.2 `namesSimilar(name1, name2)` — New in formatters.js

```javascript
/**
 * Check if two names likely refer to the same person.
 * Rules: exact match, one contains the other, first word matches.
 */
export function namesSimilar(name1, name2) {
    if (!name1 || !name2) return false;
    const n1 = name1.trim().toLowerCase();
    const n2 = name2.trim().toLowerCase();

    if (n1 === n2) return true;
    if (n1.includes(n2) || n2.includes(n1)) return true;

    const first1 = n1.split(/\s+/)[0];
    const first2 = n2.split(/\s+/)[0];
    if (first1.length >= 2 && first1 === first2) return true;

    return false;
}
```

**Design decisions:**
- First-word match requires >= 2 chars (avoid matching "S" vs "S")
- No fuzzy matching (Levenshtein) — too complex, false positives
- Matches spec in PROJECT_PLAN.md Section 4.3 exactly

#### 3.2.3 `getVisitorPrimaryPhone(visitor)` — New helper in SyncService

```javascript
/**
 * Extract and normalize the primary phone of a visitor's SELF contact.
 */
function getVisitorPrimaryPhone(visitor) {
    const selfContact = visitor.contacts?.find(c => c.relationType === 'SELF');
    const rawPhone = selfContact?.phones?.[0];
    return normalizePhone(rawPhone);
}
```

### 3.3 Modified Functions

#### 3.3.1 `SyncService.merge()` — Complete Rewrite

The merge algorithm must be rewritten to implement the full spec from PROJECT_PLAN.md Section 4.4. Here is the step-by-step logic:

```
Step 0: AUTO-BACKUP
  - Save JSON.stringify(currentState) to localStorage key "NGOApp_v2_PreSyncBackup"
  - Store backup timestamp alongside

Step 1: BUILD LOOKUP INDEXES
  - localIdMap = Map<visitorId, visitor> from local state
  - localPhoneMap = Map<normalizedPhone, visitorId> from local SELF contacts' first phone
  - Skip visitors with no phone or phone < 10 digits

Step 2: PROCESS EACH INCOMING VISITOR
  For each incoming visitor:

    // Validate
    if missing id OR missing contacts array → skip, increment skippedCount

    // Extract incoming primary phone
    incomingSelf = incoming.contacts.find(c => c.relationType === 'SELF')
    incomingPhone = normalizePhone(incomingSelf?.phones?.[0])

    // Tier 1: Match by visitor ID
    if localIdMap.has(incoming.id):
      existing = localIdMap.get(incoming.id)

      // Soft delete check
      if existing.status === 'deleted' AND incoming.status !== 'deleted':
        if existing.deletedAt > incoming.updatedAt → skip (local delete is newer)

      // Last-write-wins
      if incoming.updatedAt > existing.updatedAt:
        Replace existing with incoming (keep local ID)
        → updatedCount++
      continue  // ID matched, done with this visitor

    // Tier 2: Match by phone (only if Tier 1 failed)
    if incomingPhone AND localPhoneMap.has(incomingPhone):
      existingId = localPhoneMap.get(incomingPhone)
      existing = localIdMap.get(existingId)
      existingSelf = existing.contacts.find(c => c.relationType === 'SELF')

      if namesSimilar(incomingSelf?.name, existingSelf?.name):
        // Same person, different IDs — merge
        if incoming.updatedAt > existing.updatedAt:
          Update existing with incoming data (KEEP existing's local ID)
          → updatedByPhoneCount++
        continue  // Phone matched, done
      else:
        // Same phone, different names — potential duplicate
        duplicateFlags.push({
          incomingName: incomingSelf?.name,
          existingName: existingSelf?.name,
          phone: incomingPhone,
          incomingId: incoming.id,
          existingId: existingId
        })
        // Fall through to add as new (user reviews later)

    // Tier 3: No match — add as new
    visitorMap.set(incoming.id, incoming)
    addedCount++
    // Update phone map for subsequent incoming visitors
    if incomingPhone: localPhoneMap.set(incomingPhone, incoming.id)

Step 3: MERGE INTERACTIONS (unchanged)
  Deduplicate by interaction ID
  Validate: must have id, visitorId, interactionType

Step 4: MERGE REMINDER ACTIONS (unchanged)
  Deduplicate by action ID

Step 5: SAVE STATE + EMIT EVENTS

Step 6: RETURN RESULTS
  { added, updated, updatedByPhone, skipped, duplicateFlags[], interactionsAdded, actionsAdded }
```

**Critical detail — phone map update during iteration:** When a new visitor is added (Tier 3), their phone must be added to `localPhoneMap` so that subsequent incoming visitors can match against them. Without this, two incoming visitors with the same phone would both be added as new.

**Critical detail — "keep existing's local ID" in phone merge:** When we merge by phone, the incoming data replaces the existing visitor's fields, but the local visitor ID is preserved. This ensures that all local interactions, reminder actions, and other references to that visitor ID remain valid.

#### 3.3.2 `SyncService.prepareExport(options)` — Add interaction toggle

```javascript
prepareExport(options = {}) {
    const state = StateManager.getState();
    const machine = StateManager.getSettings().machine || {};
    const activationData = ActivationManager.getMachineInfo();

    const exportData = {
        visitors: state.visitors,
    };

    if (options.includeInteractions !== false) {
        exportData.interactions = state.interactions;
    }

    // Never export reminder actions or settings (per PROJECT_PLAN.md Section 4.6)

    return {
        metadata: {
            app: 'NGO_Visitor_Manager',
            version: APP_VERSION,
            exportedAt: new Date().toISOString(),
            machineId: activationData?.machineId,
            machineName: activationData?.machineName,
            machineRole: activationData?.machineRole
        },
        data: exportData
    };
}
```

#### 3.3.3 `SyncService.createBackup()` — New method

```javascript
createBackup() {
    const state = StateManager.getState();
    const backup = {
        state: state,
        createdAt: new Date().toISOString()
    };
    localStorage.setItem('NGOApp_v2_PreSyncBackup', JSON.stringify(backup));
    return backup.createdAt;
}
```

#### 3.3.4 `SyncService.restoreBackup()` — New method

```javascript
restoreBackup() {
    const backupJson = localStorage.getItem('NGOApp_v2_PreSyncBackup');
    if (!backupJson) return null;

    const backup = JSON.parse(backupJson);
    StateManager.setState(backup.state);
    return backup.createdAt;
}
```

#### 3.3.5 `SyncService.getBackupInfo()` — New method

```javascript
getBackupInfo() {
    const backupJson = localStorage.getItem('NGOApp_v2_PreSyncBackup');
    if (!backupJson) return null;

    const backup = JSON.parse(backupJson);
    return { createdAt: backup.createdAt };
}
```

### 3.4 SyncManager UI Changes

#### 3.4.1 Export Section Changes
- Read checkbox value: `document.querySelector('#export-history').checked`
- Pass to `SyncService.prepareExport({ includeInteractions: checked })`
- Replace inline export logic with SyncService call

#### 3.4.2 Import Section Changes
- **Remove satellite warning** (lines 67-71) → replace with role-aware guidance text
- **Fix "Sycing" typo** (line 69) → "Syncing"
- **Enhanced preview:** Show breakdown (X new, Y updates, Z flagged duplicates) — requires a dry-run or pre-analysis
- **Backup indicator:** Show "Your current data has been backed up automatically" after backup
- **Duplicate warnings:** If duplicateFlags returned, show names/phones for user awareness

#### 3.4.3 New Restore Section
- "Restore from last backup" button
- Only visible if `NGOApp_v2_PreSyncBackup` exists in localStorage
- Shows when backup was created
- Confirms before restoring

### 3.5 Constants Update
Add to `STORAGE_KEYS` in constants.js:
```javascript
PRE_SYNC_BACKUP: 'NGOApp_v2_PreSyncBackup'
```

---

## 4. Architectural Review

### 4.1 Data Flow Impact

**Current flow (unchanged):**
```
SyncManager.performImport() → SyncService.merge(data) → StateManager.setState() → StorageManager.saveState()
```

**New flow:**
```
SyncManager.performImport()
  → SyncService.createBackup()           // NEW: Step 0
  → SyncService.merge(data)               // ENHANCED: Tier 1 + 2
    → builds localIdMap + localPhoneMap    // NEW: phone index
    → normalizePhone() for matching        // NEW: phone normalization
    → namesSimilar() for safety            // NEW: name check
  → StateManager.setState()               // unchanged
  → StorageManager.saveState()             // unchanged
```

**Export flow (consolidated):**
```
SyncManager.exportHandler()
  → SyncService.prepareExport({ includeInteractions })  // CHANGED: uses service
  → downloadFile()                                        // unchanged
```

### 4.2 Storage Impact

**New localStorage key:** `NGOApp_v2_PreSyncBackup`
- Contains: full state snapshot + timestamp
- Size: same as `NGOApp_v2_State` (roughly)
- **Risk:** Doubles localStorage usage temporarily. With 5MB limit, this means effective capacity drops to ~2500 visitors during sync.
- **Mitigation:** Backup is overwritten on each sync (not accumulated). Users with large datasets should be warned.
- **Alternative considered:** Could compress, but JSON.stringify is already compact and adding compression adds complexity + dependency.

### 4.3 Backward Compatibility

- Export format: Adding `includeInteractions` toggle means some exports won't have interactions. Import already handles `packageData.interactions || []` (SyncService.js line 23), so this is safe.
- Merge return value: Adding new fields (`updatedByPhone`, `duplicateFlags`) — SyncManager must be updated to display them, but old callers won't break (they'd just ignore new fields).
- Existing visitor IDs: Phone-merge keeps existing local ID, so all references (interactions, reminder actions) remain valid.

### 4.4 Security Considerations

- `normalizePhone()` operates on strings only — no injection risk
- `namesSimilar()` uses string comparison only — no regex injection
- Backup stored in localStorage — same security model as main state
- No new external dependencies introduced

### 4.5 Performance Considerations

- Phone map construction: O(n) where n = local visitors — negligible for <5000
- Phone matching per incoming visitor: O(1) hash lookup — negligible
- Name similarity: O(1) per comparison — no fuzzy matching
- Backup creation: One JSON.stringify of full state — fast for <5MB
- **No performance concerns for target scale (< 5000 visitors)**

---

## 5. Implementation Steps

### Step 1: Add utility functions (formatters.js)
- Add `normalizePhone(phone)` function
- Add `namesSimilar(name1, name2)` function

### Step 2: Add backup storage key (constants.js)
- Add `PRE_SYNC_BACKUP: 'NGOApp_v2_PreSyncBackup'` to STORAGE_KEYS

### Step 3: Rewrite SyncService.merge() (SyncService.js)
- Import `normalizePhone`, `namesSimilar` from formatters
- Import `STORAGE_KEYS` from constants
- Add `createBackup()`, `restoreBackup()`, `getBackupInfo()` methods
- Rewrite `merge()` with full two-tier algorithm:
  - Step 0: Auto-backup
  - Step 1: Build ID map + phone map
  - Step 2: Process visitors (Tier 1 ID → Tier 2 phone → Tier 3 add new)
  - Step 3-4: Merge interactions + reminder actions (unchanged logic)
  - Step 5-6: Save + return enhanced results
- Update `prepareExport()` to accept options and use ActivationManager

### Step 4: Update SyncManager UI (SyncManager.js)
- **Export:** Wire checkbox, use SyncService.prepareExport()
- **Import guidance:** Replace satellite warning with role-aware text
- **Fix typo:** "Sycing" → "Syncing"
- **Enhanced preview:** Show add/update/skip/duplicate breakdown
- **Backup indicator:** Show backup confirmation message
- **Duplicate display:** Show flagged duplicates with names + phones
- **Restore section:** Add restore UI with button + confirmation

### Step 5: Verify build
- Run `npx vite build` to ensure no import errors
- Test dev server with `npm run dev`

### Step 6: Update PROJECT_PLAN.md
- Mark Iteration 2 as COMPLETE in Section 3
- Check off Phase 1 items in Section 6
- Update Section 2 (Current State) tables
- Add any new known issues to Section 7

---

## 6. File Change Matrix

| File | Action | Lines Changed (est.) | What Changes |
|------|--------|---------------------|--------------|
| `src/utils/formatters.js` | MODIFY | +25 | Add `normalizePhone()`, `namesSimilar()` |
| `src/utils/constants.js` | MODIFY | +1 | Add `PRE_SYNC_BACKUP` to STORAGE_KEYS |
| `src/services/SyncService.js` | REWRITE | ~150 (was 123) | Full two-tier merge, backup/restore, prepareExport with options |
| `src/components/Sync/SyncManager.js` | MODIFY | ~80 | Export wiring, import UI, restore section, duplicate display |
| `PROJECT_PLAN.md` | UPDATE | ~20 | Iteration 2 status, roadmap checkboxes |

**Files NOT changed:** Models, StateManager, StorageManager, Router, EventBus, other components. This is a focused change to sync logic and UI only.

**Total estimated diff:** ~275 lines added/modified across 5 files.

---

## 7. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Phone normalization false positive (different people, same last 10 digits) | Very Low | Medium | Name similarity check prevents auto-merge; different names = flag only |
| Phone normalization false negative (same person, different phones) | Medium | Low | Falls back to Tier 3 (add as new) — coordinator can manually merge |
| Backup doubles localStorage usage | Low | Medium | Overwritten each sync; 5MB limit still allows ~2500 visitors |
| Name similarity too loose (auto-merges different people) | Low | High | Rules are conservative: exact, contains, or first-word only |
| Name similarity too strict (misses valid matches) | Medium | Low | Misses become duplicates — added as new, coordinator reviews |
| Breaking existing ID-based sync | Very Low | Critical | Tier 1 runs first, unchanged; Tier 2 only activates on Tier 1 miss |
| Export without interactions breaks import on older version | Very Low | Low | Import already handles `interactions || []` |

---

## 8. Testing Plan

### 8.1 Unit-Level Verification (Manual in Dev Console)

**normalizePhone:**
```
normalizePhone("+91 98765-43210") === "9876543210"
normalizePhone("098765 43210") === "9876543210"
normalizePhone("9876543210") === "9876543210"
normalizePhone("12345") === null  // too short
normalizePhone("") === null
normalizePhone(null) === null
```

**namesSimilar:**
```
namesSimilar("Suresh", "Suresh") === true          // exact
namesSimilar("Suresh", "Suresh Patil") === true     // contains
namesSimilar("Suresh R.", "Suresh Kumar") === true  // first word
namesSimilar("Ramesh", "Sunita") === false          // different
namesSimilar("", "Suresh") === false                // empty
namesSimilar(null, null) === false                  // null
```

### 8.2 Integration Test Scenarios

**Test 1: Normal ID-based sync (regression)**
- Machine A has visitor V1 (id: visitor_abc)
- Machine B imports from A, gets V1
- Machine B updates V1, exports
- Machine A imports B's file → V1 updated (Tier 1)
- Expected: updatedCount=1, addedCount=0

**Test 2: Phone-based dedup (new feature)**
- Machine A has "Suresh Patil" with phone 9876543210 (id: visitor_aaa)
- Machine B has "Suresh" with phone 9876543210 (id: visitor_bbb)
- Machine A imports B's file
- Expected: visitor_bbb matches visitor_aaa by phone, names similar → merge
- Result: updatedByPhone=1, visitor_aaa updated with B's data, visitor_bbb NOT added

**Test 3: Phone match, different names (duplicate flag)**
- Machine A has "Ramesh" with phone 9876543210 (id: visitor_aaa)
- Machine B has "Sunita" with phone 9876543210 (id: visitor_bbb)
- Machine A imports B's file
- Expected: phone matches but names differ → flag as duplicate, add "Sunita" as new
- Result: addedCount=1, duplicateFlags=[{incomingName:"Sunita", existingName:"Ramesh", phone:"9876543210"}]

**Test 4: No phone (skip Tier 2)**
- Machine A has "Amit" with no phone (id: visitor_aaa)
- Machine B has "Amit" with no phone (id: visitor_bbb)
- Machine A imports B's file
- Expected: Tier 1 fails (different IDs), Tier 2 skipped (no phone) → add as new
- Result: addedCount=1

**Test 5: Soft delete respected**
- Machine A deletes visitor V1 at time T2
- Machine B has V1 (not deleted) with updatedAt=T1 (older)
- Machine A imports B's file
- Expected: V1 stays deleted (local delete is newer)

**Test 6: Soft delete overridden**
- Machine A deletes visitor V1 at time T1
- Machine B updates V1 at time T2 (newer than delete)
- Machine A imports B's file
- Expected: V1 restored with B's data (incoming is newer)

**Test 7: Export with/without interactions**
- Check "Include Interaction History" → export has interactions
- Uncheck → export has no interactions key (or empty)
- Import both variants → both work

**Test 8: Backup and restore**
- Import some data → backup created automatically
- Verify localStorage has NGOApp_v2_PreSyncBackup
- Click "Restore from last backup" → data reverts to pre-import state

**Test 9: Multiple incoming visitors with same phone**
- Import file has visitor_aaa (phone 9876543210) and visitor_bbb (phone 9876543210)
- Neither exists locally
- Expected: visitor_aaa added, visitor_bbb matches against newly-added visitor_aaa
- If names similar → merge. If different → flag duplicate + add both.

### 8.3 UI Verification

- [ ] Export button uses checkbox value
- [ ] Satellite machine shows guidance text (not warning)
- [ ] Root machine shows guidance text
- [ ] "Sycing" typo is gone
- [ ] Import preview shows: X new, Y updates, Z phone-matched, W skipped
- [ ] Duplicate flags shown as warning with names and phones
- [ ] "Your data has been backed up automatically" message shows
- [ ] Restore section visible when backup exists
- [ ] Restore section hidden when no backup
- [ ] Restore confirms before proceeding
- [ ] Page reloads after restore
- [ ] Build succeeds: `npx vite build`

---

## Appendix: Exact Code Locations Reference

| What | File | Current Lines | Action |
|------|------|--------------|--------|
| normalizePhone | formatters.js | N/A | ADD after formatPhone (line 142) |
| namesSimilar | formatters.js | N/A | ADD after normalizePhone |
| STORAGE_KEYS | constants.js | 65-68 | ADD PRE_SYNC_BACKUP |
| merge() | SyncService.js | 11-98 | REWRITE |
| prepareExport() | SyncService.js | 103-120 | MODIFY (add options param) |
| createBackup/restore/getInfo | SyncService.js | N/A | ADD new methods |
| Export handler | SyncManager.js | 136-158 | MODIFY (wire checkbox, use SyncService) |
| Satellite warning | SyncManager.js | 67-71 | REPLACE with role-aware text |
| "Sycing" typo | SyncManager.js | 69 | FIX → "Syncing" |
| Import preview | SyncManager.js | 265-284 | ENHANCE with breakdown |
| performImport results | SyncManager.js | 289-314 | UPDATE for new merge return shape |
| Restore section | SyncManager.js | N/A | ADD after import section |
