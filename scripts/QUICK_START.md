# Quick Start - Run Mock Data Script

## Step 1: Update Firebase Config

Open `scripts/addMockData.js` and find the `firebaseConfig` object (around line 30).

Replace the values with your actual Firebase credentials. You can find them in:
- `src/config/firebase.js` (they use environment variables)
- Your `.env` file
- Firebase Console → Project Settings

```javascript
const firebaseConfig = {
  apiKey: "your-actual-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

## Step 2: Run the Script

Open terminal in your project root and run:

```bash
node scripts/addMockData.js
```

That's it! The script will:
- ✅ Automatically find or create a branch
- ✅ Automatically find or create a supplier
- ✅ Add 5 products
- ✅ Add 3 services with product mappings
- ✅ Create 1 purchase order with same product twice (different usage types)
- ✅ Create batches (if PO is delivered)

## What Gets Created

1. **5 Products:**
   - Professional Hair Shampoo
   - Deep Conditioning Treatment
   - Hair Color Developer
   - Hair Styling Gel
   - Hair Treatment Serum

2. **3 Services:**
   - Haircut and Blowdry
   - Hair Color Treatment
   - Deep Conditioning

3. **1 Purchase Order:**
   - Shampoo: 20 units (Salon Use)
   - Shampoo: 10 units (OTC) ← Same product, different usage!
   - Conditioner: 15 units (Salon Use)
   - Developer: 25 units (Salon Use)

## Troubleshooting

**"Cannot use import statement"**
- Your package.json already has `"type": "module"`, so this shouldn't happen
- If it does, make sure you're using Node.js v14+

**"Firebase config not set"**
- Make sure you updated the firebaseConfig object in the script

**"Permission denied"**
- Check your Firestore security rules
- Make sure you have write permissions

## After Running

1. Go to **Inventory → Purchase Orders** in your app
2. You'll see the new purchase order
3. Mark it as "Delivered" to create batches
4. Go to **Inventory → Expiry Tracker** to see batches with usage type badges
5. Test billing - products without OTC batches will show "Salon Use Only"





