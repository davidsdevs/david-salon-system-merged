# Mock Data Generator

This script helps you populate your Firestore database with sample data to test the new usage type feature.

## Prerequisites

1. Node.js installed (v14 or higher)
2. Firebase project credentials
3. Access to your Firestore database

## Setup

1. **Install dependencies:**
   ```bash
   npm install firebase
   ```

2. **Update Firebase Config:**
   - Open `scripts/addMockData.js`
   - Replace the `firebaseConfig` object with your actual Firebase credentials
   - You can find these in `src/config/firebase.js`

3. **Update Required IDs:**
   - Open `scripts/addMockData.js`
   - Find the `main()` function
   - Replace `YOUR_BRANCH_ID` with an actual branch ID from your database
   - Replace `YOUR_SUPPLIER_ID` with an actual supplier ID (or create one first)

## Running the Script

```bash
node scripts/addMockData.js
```

## What It Creates

### Products (5 items)
- Professional Hair Shampoo
- Deep Conditioning Treatment
- Hair Color Developer
- Hair Styling Gel
- Hair Treatment Serum

### Services (3 items)
- Haircut and Blowdry (mapped to Shampoo + Gel)
- Hair Color Treatment (mapped to Developer + Serum)
- Deep Conditioning (mapped to Conditioner + Serum)

### Purchase Orders (1 order)
- Contains **same product added twice** with different usage types:
  - Shampoo: 20 units (Salon Use)
  - Shampoo: 10 units (OTC) ← Same product, different usage!
  - Conditioner: 15 units (Salon Use)
  - Developer: 25 units (Salon Use)

### Product Batches
- Automatically created from the purchase order
- Each batch inherits the usage type from the PO item
- Stock records are updated accordingly

## Testing the Feature

After running the script, you can:

1. **View Purchase Orders:**
   - Go to Inventory → Purchase Orders
   - You'll see the same product (Shampoo) listed twice with different usage types

2. **View Batches:**
   - Go to Inventory → Expiry Tracker
   - You'll see batches with "Salon Use" or "OTC" badges

3. **Test Billing:**
   - Try to add products in Billing
   - Products without OTC batches will show "Salon Use Only" badge
   - Only OTC batches can be sold directly to customers

4. **Test Services:**
   - When a service is performed, it will automatically deduct from salon-use batches
   - OTC batches remain available for direct sales

## Important Notes

⚠️ **This script will add data to your database. Make sure you're running it on a test environment or are okay with adding this test data.**

⚠️ **The script requires actual Branch ID and Supplier ID. If you don't have these, create them first in your system.**

## Customization

You can modify the mock data in `scripts/addMockData.js`:
- Add more products in the `mockProducts` array
- Add more services in the `mockServices` array
- Adjust quantities, prices, and usage types
- Add more purchase orders with different configurations

## Troubleshooting

**Error: "Firebase config not found"**
- Make sure you've updated the `firebaseConfig` object with your credentials

**Error: "Branch ID not found"**
- Create a branch in your system first, then use its ID

**Error: "Supplier ID not found"**
- Create a supplier in your system first, then use its ID

**Error: "Permission denied"**
- Make sure your Firebase security rules allow writes to the collections
- Or run this with admin privileges





