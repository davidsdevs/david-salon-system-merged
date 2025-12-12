# Schedule Data Debug Guide

## Problem
Schedule data with shifts is saved in Firestore but not showing up in the Staff Schedule UI.

## Your Schedule Document Structure
```
Document ID: (unknown)
branchId: "KYiL9JprSX3LBOYzrF6e"
startDate: November 17, 2025
isActive: false
notes: "Calendar-based configuration"
shifts:
  yCPK9oGEhIZWP0ZRro0pYoaYiz72:
    monday:
      start: "15:15"
      end: "17:00"
    tuesday:
      start: "10:16"
      end: "15:16"
    thursday:
      start: "16:16"
      end: "17:00"
```

## What We've Added

### Enhanced Logging
1. **getScheduleConfigurationsByBranch** - Logs all configs loaded for the branch
2. **getScheduleForDate** - Shows which config is selected for a date
3. **getActiveSchedulesByEmployee** - Shows employee ID matching attempts
4. **getShiftForDay** - Detailed lookup process for each shift
5. **fetchStaff** - Lists all staff member IDs being searched

### Improved ID Matching
- Now checks multiple ID fields: `id`, `uid`, `userId`
- Performs exact, reverse, and substring matching
- Provides detailed warnings when IDs don't match

## How to Diagnose

### Step 1: Open Browser Console
1. Open the Staff Schedule page in Branch Manager
2. Press F12 to open Developer Tools
3. Go to the Console tab

### Step 2: Check Configuration Loading
Look for logs starting with `[getScheduleConfigurationsByBranch]`:
```
[getScheduleConfigurationsByBranch] Found X documents for branch KYiL9JprSX3LBOYzrF6e
[getScheduleConfigurationsByBranch] Processing config [DOCUMENT_ID]...
[getScheduleConfigurationsByBranch] Adding config [DOCUMENT_ID]: ...
```

**What to check:**
- Is your schedule document being loaded?
- What's the document ID?
- What employee IDs are in the `shifts` object?

### Step 3: Check Staff Member IDs
Look for logs starting with `[fetchStaff]`:
```
[fetchStaff] Staff members being loaded: [...]
```

**What to check:**
- Do you see all 4 staff members listed?
- What are their `id` and `uid` values?
- Does `yCPK9oGEhIZWP0ZRro0pYoaYiz72` match any staff member's ID?

### Step 4: Check Date-Based Lookup
Look for logs starting with `[getScheduleForDate]`:
```
[getScheduleForDate] Looking for config for date 2025-11-17T00:00:00.000Z
[getScheduleForDate] Selected config [DOCUMENT_ID] for date ...
```

**What to check:**
- Is your config being selected for the viewing date?
- Is the `startDate` (November 17, 2025) <= the viewing date?

### Step 5: Check Employee ID Matching
Look for logs starting with `[getShiftForDay]`:
```
[getShiftForDay] Looking for shifts for member [NAME] (ID) on monday...
[getShiftForDay] ⚠️ No direct match found. Trying partial matching...
[getShiftForDay] ❌ No shift found for [NAME]...
```

**What to check:**
- Which staff member IDs are being searched?
- Do any of them match `yCPK9oGEhIZWP0ZRro0pYoaYiz72`?
- Are there warnings about ID mismatches?

## Common Issues and Solutions

### Issue 1: Employee ID Mismatch
**Symptom:** Console shows "❌ No shift found" with different IDs
**Solution:** 
- The employee ID in the schedule (`yCPK9oGEhIZWP0ZRro0pYoaYiz72`) doesn't match any staff member's ID
- Check in Firestore: Go to `users` collection and find which user has this ID
- Or update the schedule document to use the correct employee ID

### Issue 2: Config Not Loading
**Symptom:** No logs showing your schedule config
**Possible causes:**
- Document doesn't have `shifts` object
- Document has `employeeId` field (should be branch-wide config)
- Wrong `branchId`

### Issue 3: Wrong Date Range
**Symptom:** Config loads but not for the viewing date
**Solution:**
- Your config's `startDate` is November 17, 2025
- Only dates >= November 17, 2025 will show this config
- If viewing earlier dates, create a config with an earlier `startDate`

### Issue 4: Config is Active But Not Showing
**Note:** `isActive: false` is OK! The system uses date-based lookup, not active status.
- Active status only marks which config is "current"
- Date-based lookup finds the config with `startDate <= viewing date`

## Next Steps

1. **Run the diagnostic:** Open console and check all the logs
2. **Identify the issue:** Use the steps above
3. **Share the logs:** Copy relevant console logs if you need help
4. **Fix the root cause:**
   - If ID mismatch: Update schedule document with correct employee ID
   - If config not loading: Check document structure
   - If date issue: Adjust startDate or viewing date

## Quick Fix: Find Employee ID

To find which staff member has ID `yCPK9oGEhIZWP0ZRro0pYoaYiz72`:

1. Open Firestore Console
2. Go to `users` collection
3. Search for document ID `yCPK9oGEhIZWP0ZRro0pYoaYiz72`
4. Or filter by `branchId == "KYiL9JprSX3LBOYzrF6e"` and check each user's document ID

The document ID in Firestore `users` collection is what should be used as the employee ID in schedules.










