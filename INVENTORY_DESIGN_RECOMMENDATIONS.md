# Inventory Design Recommendations

## Overview
This document outlines best practices for inventory management, specifically addressing:
1. **Stock Entry Sources** - Where should new stock come from?
2. **Stock Transfers** - How should transfers be handled with batch tracking?
3. **Returned Stock** - What happens when transferred stock is returned?

---

## 1. Stock Entry Sources

### ✅ **Recommended: Purchase Orders Only for New Stock**

**Best Practice:**
- **All new stock should enter the system through Purchase Orders (POs)**
- When a PO is marked as "Delivered", it creates:
  - Product batches (with batch numbers, expiration dates, FIFO tracking)
  - Updates to `branch_stocks` collection
  - Links to the original PO for traceability

**Why?**
- Maintains complete audit trail
- Ensures proper batch tracking (expiration dates, FIFO)
- Prevents inventory discrepancies
- Standard practice in real inventory systems

### ❌ **Not Recommended: Manual Stock Creation**

**Current Issue:**
- The "Create Stock" button in `Stocks.jsx` allows manual stock creation
- This bypasses batch tracking and audit trails
- Makes it difficult to track where stock came from

**Recommendation:**
- **Remove or restrict manual stock creation**
- Only allow manual stock creation for:
  - Initial system setup (one-time migration)
  - Stock adjustments (with proper documentation)
  - System administrators only

---

## 2. Stock Transfers & Batch Tracking

### Current Implementation Issues

**Problem:**
- Stock transfers currently only update `branch_stocks` (quantity changes)
- **No batch tracking** - transferred stock loses its batch identity
- When stock is returned, it's unclear which batch it belongs to

### ✅ **Recommended Solution: Batch-Aware Transfers**

#### **When Transferring Stock (Sending Branch):**

1. **Track Which Batches Are Being Transferred**
   ```javascript
   {
     transferId: "TR-2024-001",
     fromBranchId: "branch1",
     toBranchId: "branch2",
     items: [
       {
         productId: "prod1",
         productName: "Olaplex No.3",
         quantity: 10,
         batches: [
           {
             batchId: "batch-01-id",
             batchNumber: "PO-2024-001-BATCH-001",
             quantity: 5,  // 5 units from batch-01
             expirationDate: "2025-12-31"
           },
           {
             batchId: "batch-02-id",
             batchNumber: "PO-2024-002-BATCH-001",
             quantity: 5,  // 5 units from batch-02
             expirationDate: "2026-01-15"
           }
         ]
       }
     ]
   }
   ```

2. **Deduct from Original Batches (FIFO)**
   - Use `deductStockFIFO()` to deduct from oldest batches first
   - Update `remainingQuantity` in each batch
   - Mark batches as `depleted` if `remainingQuantity` reaches 0

3. **Create Transfer Batches at Receiving Branch**
   - When transfer is marked as "Received" at receiving branch:
   - Create new batch records with:
     - `batchNumber`: `TR-{transferId}-BATCH-{sequence}`
     - `sourceType`: `"transfer"` (vs `"purchase_order"`)
     - `sourceTransferId`: Reference to original transfer
     - `originalBatchId`: Reference to original batch (for returns)
     - `originalBatchNumber`: Original batch number
     - `expirationDate`: Copy from original batch
     - `receivedDate`: Date when transfer was received
     - `fromBranchId`: Branch that sent the stock

#### **Example Transfer Batch Structure:**
```javascript
{
  batchNumber: "TR-2024-001-BATCH-001",
  productId: "prod1",
  productName: "Olaplex No.3 Hair Perfector",
  branchId: "branch2",  // Receiving branch
  sourceType: "transfer",
  sourceTransferId: "TR-2024-001",
  originalBatchId: "batch-01-id",  // For returns
  originalBatchNumber: "PO-2024-001-BATCH-001",  // For reference
  quantity: 5,
  remainingQuantity: 5,
  unitCost: 1400,  // From original batch
  expirationDate: Timestamp,  // Copy from original batch
  receivedDate: Timestamp,
  fromBranchId: "branch1",
  status: "active",
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

---

## 3. Returned Stock Handling

### The Problem You Identified

**Scenario:**
- Branch A sends Batch-01 (5 units) to Branch B
- Branch B receives it as Transfer Batch TR-001
- Branch B wants to return 3 units back to Branch A
- **Question:** Should it go back to Batch-01 or create a new batch?

### ✅ **Recommended Solution: Return to Original Batch**

#### **Option 1: Return to Original Batch (Preferred)**

**How it works:**
1. When Branch B returns stock:
   - Check `originalBatchId` from the transfer batch
   - If original batch still exists at Branch A:
     - **Restore quantity to original batch**
     - Update `remainingQuantity` in original batch
     - Mark transfer batch as `returned` or reduce its `remainingQuantity`
   - If original batch was depleted:
     - Create a new batch with `sourceType: "return"` and reference original batch

**Benefits:**
- Maintains FIFO integrity
- Preserves expiration date tracking
- Clear audit trail

**Implementation:**
```javascript
{
  batchNumber: "PO-2024-001-BATCH-001",  // Original batch
  remainingQuantity: 2,  // Was 0, now restored to 2 after return
  status: "active",  // Reactivated if was depleted
  // ... other fields
}
```

#### **Option 2: Create Return Batch (Alternative)**

**When to use:**
- Original batch no longer exists
- Returning different quantity than transferred
- Need to track returns separately

**How it works:**
```javascript
{
  batchNumber: "RET-2024-001-BATCH-001",
  productId: "prod1",
  branchId: "branch1",  // Original branch
  sourceType: "return",
  sourceTransferId: "TR-2024-001",
  originalBatchId: "batch-01-id",
  originalBatchNumber: "PO-2024-001-BATCH-001",
  quantity: 3,
  remainingQuantity: 3,
  expirationDate: Timestamp,  // Copy from original
  receivedDate: Timestamp,
  fromBranchId: "branch2",  // Branch returning the stock
  returnReason: "Overstock",
  status: "active"
}
```

---

## 4. Implementation Recommendations

### Phase 1: Restrict Manual Stock Creation
1. Remove "Create Stock" button from regular users
2. Keep only for system admins (with approval workflow)
3. All new stock must come from Purchase Orders

### Phase 2: Implement Batch-Aware Transfers
1. Update transfer creation to track source batches
2. Implement FIFO deduction when transferring
3. Create transfer batches at receiving branch
4. Link transfer batches to original batches

### Phase 3: Implement Return Functionality
1. Add "Return Stock" feature to transfers
2. Implement return-to-original-batch logic
3. Handle edge cases (depleted batches, partial returns)

### Phase 4: Enhanced Reporting
1. Track stock movement history (PO → Transfer → Return)
2. Batch traceability reports
3. Expiration date tracking across transfers

---

## 5. Database Schema Updates Needed

### `product_batches` Collection - Add Fields:
```javascript
{
  // Existing fields...
  sourceType: "purchase_order" | "transfer" | "return",
  sourcePurchaseOrderId: String | null,
  sourceTransferId: String | null,
  originalBatchId: String | null,  // For transfers/returns
  originalBatchNumber: String | null,
  fromBranchId: String | null,  // For transfers/returns
  returnReason: String | null  // For returns
}
```

### `stock_transfer` Collection - Add Fields:
```javascript
{
  // Existing fields...
  items: [
    {
      productId: String,
      productName: String,
      quantity: Number,
      batches: [  // NEW: Track which batches are being transferred
        {
          batchId: String,
          batchNumber: String,
          quantity: Number,
          expirationDate: Timestamp
        }
      ]
    }
  ]
}
```

---

## 6. Key Principles

1. **Traceability**: Every unit of stock should be traceable back to its origin (PO)
2. **FIFO Compliance**: Always use oldest batches first (for transfers and sales)
3. **Batch Integrity**: Preserve batch information through transfers
4. **Audit Trail**: Complete history of stock movement
5. **Expiration Tracking**: Maintain expiration dates through all operations

---

## Summary

**Answer to your questions:**

1. **Should all products come from Purchase Orders only?**
   - ✅ **Yes** - For new stock entering the system
   - Manual creation should be restricted to system admins only

2. **What about stock transfers?**
   - ✅ **Track batches** - Know which batches are being transferred
   - ✅ **Create transfer batches** - Receiving branch gets new batch records
   - ✅ **Link to originals** - Maintain reference to original batches

3. **If they return Batch-01, where does it go?**
   - ✅ **Return to original Batch-01** (preferred)
   - ✅ **Or create return batch** with reference to original (if batch depleted)
   - Maintains FIFO and expiration tracking

This approach ensures proper inventory management, complete traceability, and compliance with real-world inventory best practices.






