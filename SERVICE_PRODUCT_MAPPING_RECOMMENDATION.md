# Service-Product Mapping & Salon Use Product System - Recommendation

## Problem Statement

You need to:
1. **Service-Product Mapping**: Map products to services with quantity and percentage (e.g., 5ml = 10% of price, 20ml = 15% of OTC price)
2. **Prevent OTC Sales**: Products used in salon services should NOT be sellable at OTC price
3. **Batch Tracking**: Handle this with batch numbering system
4. **Receptionist Billing**: Mark products as "Salon Use Product" during billing

---

## Three Approaches Compared

### Option A: Automated "Salon Use Product Activator" (Post-Delivery Tracking)

**How It Works:**
- When a product is used in a service, the system automatically tracks which batches/quantities are "salon use only"
- Each batch can have a `salonUseQuantity` field that tracks how much of that batch is reserved for salon use
- When billing, system checks if batch has available OTC quantity before allowing sale
- Products used in services automatically mark batches as salon-use

**Pros:**
- ✅ **Accurate**: Tracks actual usage automatically
- ✅ **Error-proof**: Prevents accidental OTC sales of salon-use products
- ✅ **Audit trail**: Knows exactly which batches were used for services vs. sold OTC
- ✅ **Flexible**: Can convert between salon-use and OTC if needed
- ✅ **Real-time**: Updates immediately when services are performed

**Cons:**
- ⚠️ More complex to implement
- ⚠️ Requires batch-level tracking of usage type
- ⚠️ More data to maintain per batch

---

### Option B: Manual (Service-Product Mapping Only)

**How It Works:**
- Just add service-product mapping with quantity and percentage
- Humans manually mark products as "salon use" when adding to system
- System trusts that humans correctly mark products

**Pros:**
- ✅ Simple to implement
- ✅ Less code

**Cons:**
- ❌ **Error-prone**: Humans might forget to mark products
- ❌ **No automatic tracking**: Can't track which batches were actually used
- ❌ **Inaccurate**: Might sell salon-use products by mistake
- ❌ **No audit trail**: Can't verify if products were correctly marked

---

### Option C: Purchase Order Level Designation ✅ **NEW RECOMMENDATION**

**How It Works:**
- When creating a Purchase Order, mark each product/item as "Salon Use" or "OTC"
- When PO is delivered and batches are created, those batches are automatically marked as salon-use-only or OTC-only
- Batches are segregated from the start - entire batch is one type or the other
- No need to track partial quantities - the batch itself determines its purpose

**Pros:**
- ✅ **Simplest Implementation**: Just add a field to PO items
- ✅ **Clear Separation**: Batches are clearly designated from the start
- ✅ **Less Data Tracking**: No need for `salonUseQuantity` vs `otcAvailableQuantity`
- ✅ **Natural Fit**: Works perfectly with existing PO → Batch flow
- ✅ **Easy to Understand**: Staff can see at PO stage what's for what
- ✅ **Prevents Mistakes**: Can't accidentally sell salon-use batches OTC
- ✅ **Better Planning**: Forces planning at purchase stage

**Cons:**
- ⚠️ **Less Flexible**: Once a batch is marked salon-use or OTC, can't easily convert later
- ⚠️ **Requires Planning**: Must know at purchase time how much will be salon-use vs OTC
- ⚠️ **Over-ordering Risk**: If you order too much salon-use, can't sell it OTC (wasted inventory)
- ⚠️ **Under-ordering Risk**: If you don't order enough salon-use, might run out during busy periods
- ⚠️ **Mixed Usage Products**: Products used both ways need separate PO items (more complex POs)
- ⚠️ **No Real-time Adjustment**: Can't dynamically adjust based on actual usage patterns
- ⚠️ **Waste Potential**: Salon-use batches that expire before use can't be converted to OTC
- ⚠️ **Transfer Complexity**: Transferring batches between branches needs to respect usage type
- ⚠️ **Historical Data**: Existing batches need migration/default handling
- ⚠️ **PO Complexity**: POs become more complex (need to decide usage type for each item)

---

## **NEW RECOMMENDATION: Option C (Purchase Order Level)**

### Why Option C is Best:

1. **Simplest**: Minimal code changes - just add `usageType` to PO items
2. **Clear Intent**: Designation happens at purchase time when you know the purpose
3. **Natural Workflow**: Fits perfectly with your existing PO → Delivery → Batch flow
4. **Less Complexity**: No need to track partial quantities per batch
5. **Better Planning**: Forces you to think about usage at purchase time
6. **Easier to Manage**: Staff can see in PO what's for salon vs OTC

---

## Recommended Implementation Plan (Option C)

### Phase 1: Add Usage Type to Purchase Orders

**In Inventory Controller → Purchase Orders:**
- Add "Usage Type" dropdown to each PO item: "Salon Use" or "OTC"
- Default: "OTC" (for backward compatibility)
- When creating PO, mark items as needed

**PO Item Schema:**
```javascript
{
  productId: string,
  productName: string,
  quantity: number,
  unitPrice: number,
  usageType: "salon-use" | "otc",  // NEW FIELD
  // ... other fields
}
```

### Phase 2: Batch Creation with Usage Type

**In `inventoryService.js` → `createProductBatches()`:**
- When creating batches from PO delivery, copy `usageType` from PO item to batch
- Mark entire batch as salon-use or OTC

**Batch Schema (Extended):**
```javascript
{
  // Existing fields...
  batchNumber: "PO-2024-001-BATCH-001",
  quantity: 100,
  remainingQuantity: 85,
  unitCost: 50,
  
  // NEW: Usage type from PO
  usageType: "salon-use" | "otc",  // Determines if batch can be sold OTC
  purchaseOrderId: "po-123",
  // ... other fields
}
```

### Phase 3: Service-Product Mapping (Still Needed)

**In System Admin → Master Products:**
- Add "Service-Product Mapping" section
- Map products to services with quantity and percentage
- This is for calculating service costs, not for tracking usage type

**Product Schema:**
```javascript
{
  // Existing fields...
  serviceProductMappings: [
    {
      serviceId: string,
      serviceName: string,
      quantity: number,      // e.g., 5ml
      unit: string,          // "ml", "g", "pieces"
      percentage: number,     // e.g., 10% of service price
    }
  ]
}
```

### Phase 4: OTC Sale Prevention

**In Receptionist Billing:**
- When fetching batches for sale, filter by `usageType: "otc"`
- Show "Salon Use Only" badge on products that only have salon-use batches
- Prevent adding salon-use-only products to OTC cart

**In `inventoryService.js`:**
```javascript
async getBatchesForSale({ branchId, productId, quantity, saleType = 'otc' }) {
  const batches = await this.getProductBatches(branchId, productId, { 
    status: 'active' 
  });
  
  // Filter by usage type
  const filteredBatches = batches.batches.filter(batch => {
    if (saleType === 'otc') {
      return batch.usageType === 'otc';  // Only OTC batches
    } else if (saleType === 'salon-use') {
      return batch.usageType === 'salon-use';  // Only salon-use batches
    }
    return true;  // Both types
  });
  
  // Calculate available quantity
  const availableQuantity = filteredBatches.reduce(
    (sum, batch) => sum + (batch.remainingQuantity || 0), 
    0
  );
  
  return {
    success: availableQuantity >= quantity,
    availableQuantity,
    batches: filteredBatches
  };
}
```

### Phase 5: Service Performance (Automatic Deduction)

**When service is performed:**
- Check service-product mappings
- Deduct from salon-use batches only (using FIFO)
- If no salon-use batches available, show error

**In `billingService.js` or `serviceManagementService.js`:**
```javascript
async function deductProductsForService(serviceId, branchId) {
  const service = await getServiceById(serviceId);
  const mappings = service.productMappings || [];
  
  for (const mapping of mappings) {
    // Deduct from salon-use batches only
    await inventoryService.deductStockFIFO({
      branchId,
      productId: mapping.productId,
      quantity: mapping.quantity,
      reason: 'Service Use',
      notes: `Service: ${service.name}`,
      usageType: 'salon-use'  // NEW: Only use salon-use batches
    });
  }
}
```

---

## Database Schema Changes

### 1. Purchase Orders Collection (Extended)
```javascript
{
  // Existing fields...
  items: [
    {
      productId: string,
      productName: string,
      quantity: number,
      unitPrice: number,
      usageType: "salon-use" | "otc",  // NEW
      // ... other fields
    }
  ]
}
```

### 2. Product Batches Collection (Extended)
```javascript
{
  // Existing fields...
  batchNumber: string,
  quantity: number,
  remainingQuantity: number,
  unitCost: number,
  
  // NEW: Usage type from PO
  usageType: "salon-use" | "otc",  // NEW - determines batch purpose
  purchaseOrderId: string,
  // ... other fields
}
```

### 3. Products Collection (Extended)
```javascript
{
  // Existing fields...
  serviceProductMappings: [  // For service cost calculation
    {
      serviceId: string,
      serviceName: string,
      quantity: number,
      unit: string,
      percentage: number,  // Percentage of service price
    }
  ]
}
```

---

## Implementation Steps

### Step 1: Update Purchase Order UI
- Add "Usage Type" dropdown to PO item form
- Options: "OTC" (default) or "Salon Use"
- Save to PO document

### Step 2: Update Batch Creation
- In `createProductBatches()`, copy `usageType` from PO item to batch
- Set `batch.usageType = poItem.usageType`

### Step 3: Update Stock Fetching for Sales
- Filter batches by `usageType` when fetching for OTC sales
- Only show OTC batches in receptionist billing

### Step 4: Update Service Product Deduction
- When deducting for services, only use salon-use batches
- Show error if no salon-use batches available

### Step 5: UI Enhancements
- Show "Salon Use Only" badge on products without OTC batches
- Filter products by availability type in billing
- Show usage type in batch details

---

## Migration Strategy

1. **Backward Compatible**: 
   - Existing batches without `usageType` default to "otc"
   - Existing POs continue to work

2. **Data Migration**:
   - Set `usageType: "otc"` for all existing batches
   - System Admin can manually update if needed

3. **Gradual Rollout**:
   - Start using in new POs
   - Existing batches remain OTC by default

---

## Edge Cases & Solutions

### Q: What if I order too much salon-use product?
**A:** Options:
- Order smaller quantities
- Allow manual override to convert batch to OTC (with approval)
- Transfer to another branch that needs it

### Q: Can I change a batch from salon-use to OTC later?
**A:** Yes, but should require:
- Admin approval
- Audit log entry
- Reason for change

### Q: What if a product is used in multiple services?
**A:** Service-product mapping handles this. The mapping just calculates cost - the batch usage type determines availability.

### Q: What if I need both salon-use and OTC of the same product?
**A:** Create separate PO items:
- Item 1: 50 units, usageType: "salon-use"
- Item 2: 30 units, usageType: "otc"
- This creates separate batches automatically

---

## Comparison Summary

| Feature | Option A (Post-Delivery) | Option B (Manual) | Option C (PO Level) ✅ |
|---------|-------------------------|-------------------|----------------------|
| **Complexity** | High | Low | **Low** |
| **Accuracy** | High | Low | **High** |
| **Flexibility** | High | Medium | Medium |
| **Implementation Time** | Long | Short | **Short** |
| **Data Tracking** | Complex | Simple | **Simple** |
| **Error Prevention** | High | Low | **High** |
| **Planning Required** | Low | Low | **Medium** |

---

## Final Recommendation

**Choose Option C (Purchase Order Level Designation)** because:

1. ✅ **Simplest to implement** - Just add one field to PO items
2. ✅ **Clear and obvious** - Staff see usage type at purchase time
3. ✅ **Natural workflow** - Fits existing PO → Batch flow perfectly
4. ✅ **Less data complexity** - No partial quantity tracking needed
5. ✅ **Better planning** - Forces thinking about usage at purchase stage
6. ✅ **Prevents mistakes** - Can't accidentally sell salon-use batches OTC

**The key insight:** If you know at purchase time whether something is for salon use or OTC, designate it then. It's much simpler than tracking it later!

---

## Next Steps

1. Add `usageType` field to Purchase Order items
2. Update batch creation to copy `usageType` from PO
3. Filter batches by `usageType` in billing
4. Add service-product mapping for cost calculation
5. Update UI to show usage type and prevent OTC sales of salon-use batches

This approach is cleaner, simpler, and more maintainable than tracking usage post-delivery!

