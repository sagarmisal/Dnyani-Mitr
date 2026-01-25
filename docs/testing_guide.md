# NGO Visitor Manager v2.0 - Step-by-Step Testing Guide

## ✅ Issues Fixed

1. **Import paths** - Fixed ActivationScreen component imports
2. **Activation redirect** - Changed to page reload for proper app reinitialization
3. **PowerShell execution policy** - Enabled npm commands

---

## 📋 Testing Checklist

### Test 1: Application Startup ✓

**Steps:**
1. Open PowerShell
2. Navigate to project:
   ```powershell
   cd c:\Users\Galaxys\Downloads\NGO_Mitr_0\ngo-visitor-manager
   ```
3. Start dev server:
   ```powershell
   npm run dev
   ```
4. **Expected**: Server starts, shows:
   ```
   VITE v5.0.0  ready in XXX ms
   ➜  Local:   http://localhost:3000/
   ```

**✅ Pass Criteria**: No build errors, server running

---

### Test 2: Activation Screen Display ✓

**Steps:**
1. Open browser to: `http://localhost:3000`
2. Wait for page to load

**Expected to See:**
- ✅ "dnyani Mitra" title (or similar)
- ✅ "Version 2.0" subtitle
- ✅ Welcome message
- ✅ Master Key input field
- ✅ "Validate Key" button

**✅ Pass Criteria**: All elements visible, no console errors

---

### Test 3: Master Key Validation ✓

**Steps:**
1. In Master Key field, type: `SSP-DEV1-2026-TEST`
2. Click **"Validate Key"** button

**Expected:**
- ✅ Machine Setup section appears below
- ✅ "Validate Key" button disappears
- ✅ "Activate" button appears
- ✅ Master Key field becomes disabled
- ✅ Machine Name input field visible
- ✅ Two radio buttons for machine role visible

**✅ Pass Criteria**: Form expands correctly, no errors

---

### Test 4: Machine Setup ✓

**Steps:**
1. In "Machine Name" field, type: `Test Machine`
2. Select **"Root Machine"** radio button
3. Click **"Activate"** button

**Expected:**
- ✅ Success message appears: "Activation successful! Redirecting..."
- ✅ Message shows in green text
- ✅ After ~1.5 seconds, page reloads automatically
- ✅ After reload, main application appears (NOT activation screen)

**✅ Pass Criteria**: Successful activation and redirect

---

### Test 5: Main Application Display ✓

**After page reloads, you should see:**

**Header:**
- ✅ Logo
- ✅ "Dnyani Mitra" title
- ✅ "Verified Visitor & Reminder System" subtitle
- ✅ Machine info on right: "Test Machine" + "📊 Root Machine"

**Navigation:**
- ✅ Nav buttons: Visitors, Reminders, Data/Sync, About
- ✅ "Visitors" button is highlighted/active

**Main Content:**
- ✅ "Visitors" heading
- ✅ Search box
- ✅ Category filter dropdown
- ✅ Sort dropdown
- ✅ "Add Visitor" button
- ✅ Empty state message: "No visitors found"
- ✅ "Add Your First Visitor" button

**Footer:**
- ✅ "© 2026 Sewa Sankalp Pratishthan"

**✅ Pass Criteria**: All UI elements present and styled correctly

---

### Test 6: Navigation Between Pages ✓

**Steps:**
1. Click **"Reminders"** nav button

**Expected:**
- ✅ Page changes to show "Reminders" heading
- ✅ "Reminders" nav button is now highlighted

2. Click **"About"** nav button

**Expected:**
- ✅ Shows About page with machine info

3. Click **"Visitors"** to return

**✅ Pass Criteria**: Navigation works, content changes, active state updates

---

### Test 7: Visitor List Features ✓

**On Visitors page:**

1. **Test Search Box:**
   - Type anything in search box
   - Should see "Showing 0 visitors" (no data yet)

2. **Test Add Visitor Button:**
   - Click "Add Visitor" or "Add Your First Visitor"
   - Should navigate to Add Visitor page

**✅ Pass Criteria**: All controls functional, no errors

---

### Test 8: Browser Console Check ✓

**Steps:**
1. Press **F12** to open Developer Tools
2. Click **Console** tab
3. Check for errors

**Expected:**
- ✅ Should see: "NGO Visitor & Reminder Manager v2.0 - Initializing..."
- ❌ Should NOT see any red errors

**✅ Pass Criteria**: No critical errors in console

---

### Test 9: LocalStorage Verification ✓

**Steps:**
1. In Developer Tools (F12), click **Application** tab
2. Expand **Local Storage** in left sidebar
3. Click **http://localhost:3000**

**Expected to See:**
- ✅ `NGOApp_v2_State` key with JSON data containing state.
- ✅ `NGOApp_v2_Activation` key with activation data.

**✅ Pass Criteria**: Data persisted correctly in localStorage

---

### Test 10: Refresh Persistence ✓

**Steps:**
1. Press **F5** to refresh page

**Expected:**
- ✅ Page reloads
- ✅ Goes directly to main app (NOT activation screen)
- ✅ Machine info still shows "Test Machine"

**✅ Pass Criteria**: Activation persists across refreshes
