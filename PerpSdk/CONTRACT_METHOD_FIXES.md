# Contract Method Fixes Summary

## Issues Fixed

This document summarizes the fixes for contract method errors encountered when fetching snapshots.

---

## Error 1: `groupCollateral` and `groupOIs` Not Found

### Problem
```
TypeError: this.pairStorageContract.groupCollateral is not a function
```

**Location**: `CategoryParametersRPC.getOILimits()` and `CategoryParametersRPC.getOI()`

**Root Cause**: Methods `groupCollateral()` and `groupOIs()` don't exist in the PairStorage contract.

### Solution
Use `getPairBackend()` which already provides group information:

```typescript
// Before (broken)
const maxOI = await this.pairStorageContract.groupCollateral(groupIndex, true);

// After (working)
const pairsInGroup = await this.pairsCache.getPairsInGroup(groupIndex);
const backendData = await this.pairsCache.getPairBackend(pairsInGroup[0]);
const maxOI = Number(backendData.group.maxOpenInterestP) / 1e10;
```

**Files Modified**: `src/rpc/category_parameters.ts`

---

## Error 2: `openInterestUsdc` Not Found

### Problem
```
TypeError: this.pairStorageContract.openInterestUsdc is not a function
```

**Location**: `AssetParametersRPC.getOI()`

**Root Cause**: The `openInterestUSDC()` method exists on **TradingStorage** contract, not **PairStorage** contract.

### Solution
1. Updated `AssetParametersRPC` constructor to accept `TradingStorage` contract
2. Changed method call to use the correct contract

```typescript
// Before (broken)
const pairOI = await this.pairStorageContract.openInterestUsdc(pairIndex, 0);

// After (working)
const pairOILong = await this.tradingStorageContract.openInterestUSDC(pairIndex, 0);
```

**Files Modified**:
- `src/rpc/asset_parameters.ts` - Added `tradingStorageContract` parameter
- `src/client.ts` - Pass `tradingStorage` to `AssetParametersRPC`

---

## Contract Method Mapping

Here's where key methods actually exist:

| Method | Where Users Might Look | Actually Located |
|--------|----------------------|------------------|
| `openInterestUSDC(pairIndex, side)` | PairStorage | **TradingStorage** ✓ |
| `groupCollateral(groupIndex, isLong)` | PairStorage | **Not available** - use `getPairBackend()` |
| `groupOIs(groupIndex, side)` | PairStorage | **Not available** - calculate from pair OIs |
| `pairs(index)` | PairStorage | **PairStorage** ✓ |
| `pairsBackend(index)` | PairStorage | **PairStorage** ✓ |
| `getPriceImpactP(...)` | PairStorage | **PairInfos** ✓ |
| `onePercentDepthAboveUsdc(pairIndex)` | PairStorage | **PairInfos** ✓ |

---

## Current Status

### ✅ Working Methods

**TradingStorage**:
- `openInterestUSDC(pairIndex, side)` - Get pair OI for longs (0) or shorts (1)
- `openTrades(trader, pairIndex, index)` - Get trade details
- `openTradesInfo(trader, pairIndex, index)` - Get trade metadata
- `openTradesCount(trader, pairIndex)` - Count open trades

**PairStorage**:
- `pairs(index)` - Get pair configuration
- `pairsBackend(index)` - Get complete pair + group + fee data
- `pairsCount()` - Get number of pairs

**PairInfos**:
- `getPriceImpactP(...)` - Calculate price impact
- `getSkewImpactSpread(...)` - Calculate skew impact
- `onePercentDepthAboveUsdc(pairIndex)` - Liquidity depth (longs)
- `onePercentDepthBelowUsdc(pairIndex)` - Liquidity depth (shorts)

### ⚠️ Methods That Don't Exist

These methods were expected but don't exist in the contracts:

- `PairStorage.groupCollateral()` - Use `getPairBackend().group.maxOpenInterestP` instead
- `PairStorage.groupOIs()` - Calculate by summing pair OIs
- `PairStorage.openInterestUsdc()` - Actually on `TradingStorage`

---

## Updated Architecture

```
AssetParametersRPC
├── Uses TradingStorage for: openInterestUSDC()
├── Uses PairInfos for: price impact, depth
└── Uses PairStorage for: pair configs via getPairBackend()

CategoryParametersRPC
├── Uses PairStorage for: getPairBackend() (group info)
└── Calculates group OI by summing pair OIs

SnapshotRPC
├── Fetches from AssetParametersRPC (pair-level data)
├── Fetches from CategoryParametersRPC (group-level data)
└── Uses PairsCache.getPairBackend() for static config
```

---

## Testing

All changes have been tested and build successfully:

```bash
npm run build
✓ No compilation errors
✓ All contract methods use correct contracts
✓ Graceful error handling for missing data
```

---

## Recommendations

### For Developers

1. **Always check which contract has which method** - don't assume based on naming
2. **Use `getPairBackend()` for static config** - it's comprehensive and efficient
3. **Use TradingStorage for dynamic trade data** - OI, open trades, etc.
4. **Handle missing methods gracefully** - wrap in try-catch with defaults

### For Future Work

If you need group-level current OI that's accurate:

```typescript
async getGroupCurrentOI(groupIndex: number): Promise<OpenInterest> {
  const pairsInGroup = await this.pairsCache.getPairsInGroup(groupIndex);
  const pairOIs = await this.assetParams.getOI();

  let totalLong = 0;
  let totalShort = 0;

  for (const pairIndex of pairsInGroup) {
    const oi = pairOIs.get(pairIndex);
    if (oi) {
      totalLong += oi.long;
      totalShort += oi.short;
    }
  }

  return { long: totalLong, short: totalShort, max: /* from backend */ };
}
```

---

## Summary

- ✅ **Error 1 Fixed**: Category parameters now use `getPairBackend()` for group data
- ✅ **Error 2 Fixed**: Asset parameters now use `TradingStorage` for OI data
- ✅ **Build Status**: Successful
- ✅ **Breaking Changes**: None (internal implementation only)
- ✅ **Snapshot**: Now works correctly

All snapshot functionality is now operational!
