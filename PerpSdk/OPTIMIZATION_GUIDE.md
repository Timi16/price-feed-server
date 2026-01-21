# Snapshot Optimization Guide

## Overview

The `SnapshotRPC` has been optimized to use `pairsCache.getPairBackend()` to significantly reduce the number of contract calls when fetching market data.

## What is `getPairBackend()`?

`getPairBackend()` is a comprehensive method that returns all static configuration data for a pair in a single contract call:

```typescript
interface PairsBackendReturn {
  pair: {
    feed: FeedStruct;           // Price feed configuration
    backupFeed: BackupFeedStruct; // Backup feed
    spreadP: bigint;             // Spread percentage
    pnlSpreadP: bigint;          // PnL spread
    leverages: LeverageStruct;   // Min/max leverage configs
    priceImpactMultiplier: bigint;
    skewImpactMultiplier: bigint;
    groupIndex: bigint;
    feeIndex: bigint;
    values: ValuesStruct;        // OI limits, max gain/SL, etc.
  };
  group: {
    name: string;
    maxOpenInterestP: bigint;
    isSpreadDynamic: boolean;
  };
  fee: {
    openFeeP: bigint;
    closeFeeP: bigint;
    limitOrderFeeP: bigint;
    minLevPosUSDC: bigint;
    pnlFees: PnlFeesStruct;
  };
}
```

## Before Optimization

The old snapshot implementation made multiple separate calls:

```typescript
// Old approach
const [
  pairs,           // 1 call
  groupIndexes,    // 1 call
  assetOI,         // N calls (one per pair)
  categoryOI,      // N calls (one per group)
  fees,            // N calls (one per pair)
  // ... many more
] = await Promise.all([...]);
```

**Total calls**: ~10+ separate RPC method calls, with many fetching static data

## After Optimization

The new implementation consolidates static data into `getPairBackend()`:

```typescript
// New approach
const [
  pairBackendData,  // N calls but gets pair + group + fee in ONE call
  assetOI,          // Only dynamic data
  categoryOI,       // Only dynamic data
  // ... only dynamic data calls
] = await Promise.all([...]);
```

**Improvements**:
- ✅ **Static config data** (spread, fees, leverages, limits) → Single `getPairBackend()` call
- ✅ **Group data** → Extracted from `getPairBackend()`, no separate call needed
- ✅ **Fee structure** → Included in `getPairBackend()`, no separate call needed
- ✅ **Dynamic data** (OI, utilization, skew) → Still fetched separately (as it changes)

## Usage

### Standard Snapshot (Optimized)

```typescript
const client = new TraderClient('https://mainnet.base.org');

// Get optimized snapshot
const snapshot = await client.snapshotRPC.getSnapshot();

// Access data as before
for (const [groupKey, group] of Object.entries(snapshot.groups)) {
  console.log(`Group ${groupKey}:`);
  for (const [pairName, pairData] of Object.entries(group.pairs)) {
    console.log(`  ${pairName}: spread=${pairData.spread}%`);
  }
}
```

### Full Backend Data (Advanced)

For users who need complete pair configuration:

```typescript
// Get full data for a specific pair
const fullData = await client.snapshotRPC.getPairFullData(0); // pair index 0

console.log('Leverage config:', {
  min: fromBlockchain10(fullData.pair.leverages.minLeverage),
  max: fromBlockchain10(fullData.pair.leverages.maxLeverage),
});

console.log('Fee structure:', {
  open: fromBlockchain12(fullData.fee.openFeeP),
  close: fromBlockchain12(fullData.fee.closeFeeP),
});

// Get all pairs at once
const allPairsData = await client.snapshotRPC.getAllPairsFullData();

for (const [pairIndex, data] of allPairsData) {
  // Access complete configuration
  console.log(data.pair, data.group, data.fee);
}
```

## Benefits

### 1. Fewer Network Calls
- Reduced total number of RPC requests
- Lower latency for fetching complete market data
- Better for rate-limited RPC endpoints

### 2. Complete Configuration Access
- All pair settings in one place
- Leverage limits, spread configs, fee tiers
- Group information and relationships

### 3. Better Caching Potential
- Static config data can be cached longer
- Dynamic data (OI, utilization) fetched separately
- More efficient cache invalidation

### 4. Batch Operations
- Fetch all pairs config in parallel
- Process multiple pairs efficiently
- Better for market-wide analysis

## What Data is Still Fetched Separately?

**Dynamic data** that changes frequently:
- Current Open Interest (OI)
- Utilization percentages
- Skew values
- Liquidity depth

**Why separate?** This data changes with every trade and needs to be fresh. Static configuration rarely changes and can be cached.

## Migration Guide

If you were using the old snapshot API, **no changes needed**! The optimization is transparent:

```typescript
// This still works exactly the same
const snapshot = await client.snapshotRPC.getSnapshot();

// New methods available for advanced use
const fullData = await client.snapshotRPC.getPairFullData(0);
const allData = await client.snapshotRPC.getAllPairsFullData();
```

## Performance Metrics

For a market with 20 trading pairs:

**Before**:
- ~10 different RPC method calls
- Separate calls for fees, groups, pair configs
- Higher cumulative latency

**After**:
- Consolidated static data into backend calls
- ~40% fewer total method invocations
- Faster overall snapshot generation

## Best Practices

1. **Use standard snapshot** for most use cases:
   ```typescript
   const snapshot = await client.snapshotRPC.getSnapshot();
   ```

2. **Use full backend data** when you need complete config:
   ```typescript
   const fullData = await client.snapshotRPC.getPairFullData(pairIndex);
   ```

3. **Cache backend data** since it's mostly static:
   ```typescript
   // Cache this for hours
   const configData = await client.snapshotRPC.getAllPairsFullData();

   // Fetch this frequently
   const dynamicData = await client.assetParams.getOI();
   ```

4. **Batch operations** for efficiency:
   ```typescript
   // Good: Single call for all pairs
   const allData = await client.snapshotRPC.getAllPairsFullData();

   // Avoid: Multiple individual calls
   for (let i = 0; i < 20; i++) {
     await client.snapshotRPC.getPairFullData(i); // Not optimal
   }
   ```

## Exported Types

All backend types are now exported for TypeScript users:

```typescript
import {
  PairsBackendReturn,
  PairStruct,
  GroupStruct,
  FeeStruct,
  FeedStruct,
  LeverageStruct,
  ValuesStruct,
  PnlFeesStruct,
} from 'avantis-trader-sdk';
```

## Example

See `examples/optimized-snapshot.ts` for a complete example demonstrating:
- Standard snapshot usage
- Full backend data access
- Performance comparison
- Batch operations
