# Testing Instructions for Inventory Deduction Issue

## Overview
The issue: Individual production lots (lotes) are being correctly decremented, but the aggregate raw_material_inventory is NOT being updated after registering production variance.

## What Was Fixed
1. ✅ UI bug: Required quantity in progress bar now correctly multiplies by cantidadProducida
2. 🔧 Added plant_id filtering to inventory query in guardarVariancia
3. 🔧 Added verification queries to check if updates actually succeeded
4. 🔧 Improved error handling with detailed logging

## Testing Steps

### Step 1: Open Browser Developer Tools
1. Open your POS application in Chrome/Edge
2. Press `F12` to open Developer Tools
3. Go to the **Console** tab
4. Clear existing logs (Ctrl+L or click the clear icon)

### Step 2: Perform a Production Entry
1. Navigate to **Costos** section
2. Select a product that has ingredients
3. Enter a production quantity (e.g., 5)
4. Select ingredients from available batches
5. Click "Calcular Variancia" to see the cost breakdown
6. Click "Guardar" to register the production

### Step 3: Check Console Logs
After clicking "Guardar", look for these log messages in the Console:

#### Expected Success Logs:
```
Descontando inventario: material=<UUID>, state=<UUID>, qty=<number>
Actualizando inventario ID <UUID>: <old-qty> - <qty> = <new-qty>
✓ Inventario actualizado correctamente a <new-qty>
```

#### Error Messages to Look For:
- `Error consultando inventario: ...` - Problem finding inventory record
- `Error actualizando inventario: ...` - Problem updating inventory
- `Inventario no se actualizó. ID <UUID>: esperado=<X>, actual=<Y>` - Update failed silently
- `No se encontró inventario para material=..., state=...` - No inventory record exists

### Step 4: Verify Database State

#### Check Batch Deductions (SHOULD work):
Go to **Historial** and look for your production entry. The selected batches should show `quantity_out = 0` after production.

#### Check Inventory Aggregate:
1. Go back to **Costos** section
2. Look at the material list
3. Find the material you just used
4. Check the displayed quantity - it SHOULD have decreased

### Step 5: Diagnose Based on Console Output

#### Scenario A: All logs show success ✓
- Inventory should be updated
- If inventory still shows old value in UI, it may be a caching issue
- Try refreshing the page (F5) and check again

#### Scenario B: "No se encontró inventario" message
- The raw_material_inventory record doesn't exist
- Possible causes:
  - Inventory was never created for this material+state combination
  - plant_id mismatch if column exists
- **Action**: Create the inventory record manually in Supabase

#### Scenario C: "Error consultando inventario" or "Error actualizando inventario"
- There's a database error
- **Action**: Check the complete error message and let me know
- Possible causes:
  - RLS policy blocking updates
  - plant_id column doesn't exist (but we're filtering by it)
  - state_id or raw_material_id values are wrong

#### Scenario D: "Inventario no se actualizó" message
- The update was accepted but didn't actually change the database
- **Action**: Check RLS policies on raw_material_inventory table
- This usually means Row Level Security is preventing the update

### Step 6: Check RLS Policies

In **Supabase Dashboard** > SQL Editor:

```sql
-- Check RLS policies on raw_material_inventory
SELECT * 
FROM pg_policies 
WHERE tablename = 'raw_material_inventory';

-- Check table structure
\d raw_material_inventory
```

Look for:
- Is RLS enabled? (`ALTER TABLE raw_material_inventory ENABLE ROW LEVEL SECURITY;`)
- Are there policies that might block UPDATE operations?
- Does the table have a `plant_id` column?

### Step 7: If plant_id Column Doesn't Exist

If the query returns an error like "column 'plant_id' does not exist", then:
1. Let me know - we need to remove the plant_id filter
2. The table might be shared across plants (which is another issue)

## Critical Information to Collect

When reporting the issue, please provide:

1. **Console Logs**: Screenshot or text of all logs from Step 3
2. **Batch State**: Did the batch `quantity_out` go to 0? (Yes/No)
3. **Inventory Display**: What was the inventory quantity before and after?
4. **Error Messages**: Any specific error messages from the console
5. **RLS Status**: Is RLS enabled on raw_material_inventory?
6. **Column Check**: Does raw_material_inventory have a `plant_id` column?

## Potential Root Causes Ranked by Likelihood

1. **plant_id column issue** - If the table has plant_id but it's NULL or different
2. **RLS policy blocking updates** - Policy doesn't allow authenticated user to update
3. **Missing inventory record** - Inventory was never created for material+state
4. **state_id mismatch** - The state_id in batch doesn't match inventory state_id
5. **Concurrent update issue** - Race condition with another user/process

## Next Steps After Testing

After you complete the testing and check the console logs, let me know:
- What error messages you see (if any)
- Whether the batches are being decremented correctly
- The complete console output from the inventory deduction section

This will help me identify the exact cause and provide a targeted fix.
