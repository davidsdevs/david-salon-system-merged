# How to Run Mock Data Script

## Quick Start

1. **Open your terminal/command prompt in the project root**

2. **Install Firebase (if not already installed):**
   ```bash
   npm install firebase
   ```

3. **Edit the script to add your Firebase credentials:**
   - Open `scripts/addMockData.js`
   - Find the `firebaseConfig` object (around line 17)
   - Replace with your actual Firebase config values
   - You can find these in `src/config/firebase.js` or your `.env` file

4. **Edit the script to add your Branch and Supplier IDs:**
   - Open `scripts/addMockData.js`
   - Find the `main()` function (around line 280)
   - Replace `YOUR_BRANCH_ID` with your actual branch ID
   - Replace `YOUR_SUPPLIER_ID` with your actual supplier ID
   - Or set them to empty strings and the script will try to find/create them

5. **Run the script:**
   ```bash
   node scripts/addMockData.js
   ```

## Option 1: Using .mjs extension (Recommended)

If you get "Cannot use import statement" error, rename the file:
```bash
mv scripts/addMockData.js scripts/addMockData.mjs
node scripts/addMockData.mjs
```

## Option 2: Add to package.json

Add this to your `package.json`:
```json
{
  "type": "module"
}
```

Then run:
```bash
node scripts/addMockData.js
```

## Option 3: Use CommonJS version

If you prefer CommonJS, I can create a `addMockData.cjs` version. Let me know!

## Finding Your IDs

### Branch ID
1. Go to your Firebase Console
2. Navigate to Firestore Database
3. Open the `branches` collection
4. Copy any branch document ID

### Supplier ID
1. Go to your Firebase Console
2. Navigate to Firestore Database
3. Open the `suppliers` collection
4. Copy any supplier document ID
5. OR let the script create one for you (it will try to find or create)

## What the Script Does

1. ✅ Adds 5 products to your database
2. ✅ Adds 3 services with product mappings
3. ✅ Creates 1 purchase order with:
   - Same product (Shampoo) added twice:
     - 20 units (Salon Use)
     - 10 units (OTC)
   - Other products with salon-use designation
4. ✅ Creates product batches from the PO (if PO is marked as delivered)
5. ✅ Updates stock records

## Troubleshooting

**Error: "Cannot use import statement"**
- Solution: Rename file to `.mjs` or add `"type": "module"` to package.json

**Error: "Firebase config not found"**
- Make sure you've updated the `firebaseConfig` object in the script

**Error: "Permission denied"**
- Check your Firestore security rules
- Make sure you have write permissions

**Error: "Branch ID not found"**
- Create a branch in your system first
- Or update the script to create one automatically

**Error: "Supplier ID not found"**
- The script will try to create one automatically
- Or create a supplier in your system first

## After Running

1. Go to **Inventory → Purchase Orders**
2. You'll see the new purchase order
3. Mark it as "Delivered" to create batches
4. Go to **Inventory → Expiry Tracker** to see batches with usage type badges
5. Test billing - products without OTC batches will show "Salon Use Only"





