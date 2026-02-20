/**
 * Optimized Snapshot Example
 * Demonstrates the optimized snapshot that uses getPairBackend() to reduce contract calls
 */

import { TraderClient, fromBlockchain10, fromBlockchain12 } from '../src';

async function main() {
  // Initialize client
  const client = new TraderClient('https://base.meowrpc.com');

  console.log('=== OPTIMIZED SNAPSHOT DEMO ===\n');

  // ==================== STANDARD SNAPSHOT ====================

  console.log('1. Getting market snapshot (optimized)...');
  const snapshot = await client.snapshotRPC.getSnapshot();

  console.log('\nSnapshot groups:', Object.keys(snapshot.groups));

  // Display first group
  const firstGroupKey = Object.keys(snapshot.groups)[0];
  if (firstGroupKey) {
    const group = snapshot.groups[firstGroupKey];
    console.log(`\n${firstGroupKey} details:`);
    console.log('  Pairs in group:', Object.keys(group.pairs).length);
    console.log('  Group OI:', group.openInterest);
    console.log('  Group Utilization:', group.utilization);
    console.log('  Group Skew:', group.skew);

    // Display first pair in group
    const firstPairName = Object.keys(group.pairs)[0];
    if (firstPairName) {
      const pair = group.pairs[firstPairName];
      console.log(`\n  ${firstPairName} details:`);
      console.log('    Max Leverage:', pair.pairInfo.maxLeverage);
      console.log('    Spread:', pair.spread);
      console.log('    Fee:', pair.fee?.feeP);
      console.log('    OI:', pair.openInterest);
      console.log('    Utilization:', pair.utilization);
      console.log('    Depth Above:', pair.depth?.onePercentDepthAboveUsdc);
      console.log('    Depth Below:', pair.depth?.onePercentDepthBelowUsdc);
    }
  }

  // ==================== FULL BACKEND DATA ====================

  console.log('\n\n2. Getting full backend data for a pair...');

  // Get full backend data for BTC/USD (usually pair index 0)
  const pairIndex = 0;
  const fullData = await client.snapshotRPC.getPairFullData(pairIndex);

  console.log('\nFull pair data structure:');
  console.log('  Pair Config:');
  console.log('    Feed ID:', fullData.pair.feed.feedId);
  console.log('    Max Open Deviation:', fromBlockchain10(fullData.pair.feed.maxOpenDeviationP), '%');
  console.log('    Max Close Deviation:', fromBlockchain10(fullData.pair.feed.maxCloseDeviationP), '%');
  console.log('    Spread:', fromBlockchain10(fullData.pair.spreadP), '%');
  console.log('    PnL Spread:', fromBlockchain10(fullData.pair.pnlSpreadP), '%');

  console.log('\n  Leverage Config:');
  console.log('    Min Leverage:', fromBlockchain10(fullData.pair.leverages.minLeverage), 'x');
  console.log('    Max Leverage:', fromBlockchain10(fullData.pair.leverages.maxLeverage), 'x');
  console.log('    PnL Min Leverage:', fromBlockchain10(fullData.pair.leverages.pnlMinLeverage), 'x');
  console.log('    PnL Max Leverage:', fromBlockchain10(fullData.pair.leverages.pnlMaxLeverage), 'x');

  console.log('\n  OI & Risk Config:');
  console.log('    Max Long OI:', fromBlockchain10(fullData.pair.values.maxLongOiP), '%');
  console.log('    Max Short OI:', fromBlockchain10(fullData.pair.values.maxShortOiP), '%');
  console.log('    Group OI %:', fromBlockchain10(fullData.pair.values.groupOpenInterestPercentageP), '%');
  console.log('    Max Wallet OI:', fromBlockchain10(fullData.pair.values.maxWalletOIP), '%');
  console.log('    Max Gain:', fromBlockchain10(fullData.pair.values.maxGainP), '%');
  console.log('    Max SL:', fromBlockchain10(fullData.pair.values.maxSlP), '%');
  console.log('    Is USDC Aligned:', fullData.pair.values.isUSDCAligned);

  console.log('\n  Group Info:');
  console.log('    Name:', fullData.group.name);
  console.log('    Max OI:', fromBlockchain10(fullData.group.maxOpenInterestP), '%');
  console.log('    Dynamic Spread:', fullData.group.isSpreadDynamic);

  console.log('\n  Fee Structure:');
  console.log('    Open Fee:', fromBlockchain12(fullData.fee.openFeeP), '%');
  console.log('    Close Fee:', fromBlockchain12(fullData.fee.closeFeeP), '%');
  console.log('    Limit Order Fee:', fromBlockchain12(fullData.fee.limitOrderFeeP), '%');
  console.log('    Min Lev Position:', fromBlockchain10(fullData.fee.minLevPosUSDC), 'USDC');

  console.log('\n  PnL Fees:');
  console.log('    Number of Tiers:', fullData.fee.pnlFees.numTiers.toString());
  if (fullData.fee.pnlFees.tierP.length > 0) {
    fullData.fee.pnlFees.tierP.forEach((tier, i) => {
      console.log(`    Tier ${i}: ${fromBlockchain10(tier)}% -> Fee: ${fromBlockchain12(fullData.fee.pnlFees.feesP[i])}%`);
    });
  }

  // ==================== ALL PAIRS FULL DATA ====================

  console.log('\n\n3. Getting full backend data for all pairs...');

  const allPairsData = await client.snapshotRPC.getAllPairsFullData();

  console.log(`\nLoaded full data for ${allPairsData.size} pairs`);

  // Get pair names
  const pairs = await client.pairsCache.getPairsInfo();

  // Display summary of all pairs
  console.log('\nAll pairs summary:');
  for (const [pairIdx, backendData] of allPairsData) {
    const pairInfo = pairs.get(pairIdx);
    if (pairInfo) {
      const maxLev = fromBlockchain10(backendData.pair.leverages.maxLeverage);
      const spreadP = fromBlockchain10(backendData.pair.spreadP);
      const openFeeP = fromBlockchain12(backendData.fee.openFeeP);

      console.log(`  ${pairInfo.from}/${pairInfo.to}:`);
      console.log(`    Max Leverage: ${maxLev}x`);
      console.log(`    Spread: ${spreadP}%`);
      console.log(`    Open Fee: ${openFeeP}%`);
      console.log(`    Group: ${backendData.group.name}`);
    }
  }

  // ==================== PERFORMANCE COMPARISON ====================

  console.log('\n\n4. Performance comparison...');
  console.log('\nOld approach (multiple calls):');
  console.log('  - getPairsInfo() - 1 call');
  console.log('  - getGroupIndexes() - 1 call');
  console.log('  - getOI() (asset) - N calls per pair');
  console.log('  - getOI() (category) - N calls per group');
  console.log('  - getMarginFee() - N calls per pair');
  console.log('  - And many more...');
  console.log('  TOTAL: ~10+ separate RPC calls');

  console.log('\nNew optimized approach:');
  console.log('  - getPairsInfo() - 1 call (to get count)');
  console.log('  - getPairBackend() - N calls (but includes pair + group + fee)');
  console.log('  - getOI() (dynamic data) - still needed');
  console.log('  - getUtilization() (dynamic data) - still needed');
  console.log('  - getSkew() (dynamic data) - still needed');
  console.log('  TOTAL: Reduced by eliminating separate group and fee calls');

  console.log('\nBenefits:');
  console.log('  ✓ Fewer total RPC calls');
  console.log('  ✓ All static config data in one call');
  console.log('  ✓ Access to complete pair configuration');
  console.log('  ✓ Better for batch operations');
  console.log('  ✓ More efficient caching opportunities');
}

// Run the example
main().catch(console.error);
