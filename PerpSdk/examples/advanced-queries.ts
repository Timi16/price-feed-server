/**
 * Advanced Queries Example
 * Demonstrates pair info queries and multicall functionality
 */

import { TraderClient } from '../src';

async function main() {
  // Initialize client
  const client = new TraderClient('https://mainnet.base.org');

  console.log('=== PAIR INFO QUERIES ===\n');

  // ==================== PRICE IMPACT & SPREAD ====================

  console.log('1. Calculating price impact and spread...');

  const pairIndex = 0; // BTC/USD
  const positionSize = 1000; // 1000 USDC
  const isLong = true;

  // Get price impact spread
  const priceImpact = await client.pairInfoQueries.getPriceImpactSpread(
    pairIndex,
    isLong,
    positionSize,
    true // isOpen
  );
  console.log('Price impact spread:', priceImpact, '%');

  // Get skew impact spread
  const skewImpact = await client.pairInfoQueries.getSkewImpactSpread(
    pairIndex,
    isLong,
    positionSize,
    true
  );
  console.log('Skew impact spread:', skewImpact, '%');

  // Get total price impact
  const totalImpact = await client.pairInfoQueries.getPriceImpactP(pairIndex, isLong, positionSize);
  console.log('Total price impact:', totalImpact, '%');

  // ==================== FEES ====================

  console.log('\n2. Calculating fees...');

  // Get opening fee in USDC
  const openFeeUsdc = await client.pairInfoQueries.getOpenFeeUsdc(pairIndex, positionSize, isLong);
  console.log('Opening fee (USDC):', openFeeUsdc);

  // Get opening fee percentage
  const openFeeP = await client.pairInfoQueries.getOpenFeeP(pairIndex, positionSize, isLong);
  console.log('Opening fee percentage:', openFeeP, '%');

  // Get margin fee percentage
  const marginFeeP = await client.pairInfoQueries.getPairMarginFeeP(pairIndex);
  console.log('Margin fee percentage:', marginFeeP, '%');

  // ==================== LOSS PROTECTION ====================

  console.log('\n3. Checking loss protection...');

  // Get loss protection tier for position size
  const tier = await client.pairInfoQueries.getLossProtectionTierForSize(pairIndex, positionSize);
  console.log('Loss protection tier:', tier);

  // Get loss protection percentage
  const protectionP = await client.pairInfoQueries.getLossProtectionP(pairIndex, tier);
  console.log('Loss protection percentage:', protectionP, '%');

  // ==================== LIQUIDITY DEPTH ====================

  console.log('\n4. Checking liquidity depth...');

  const depth = await client.pairInfoQueries.getDepth(pairIndex);
  console.log('1% depth above (longs):', depth.above, 'USDC');
  console.log('1% depth below (shorts):', depth.below, 'USDC');

  // ==================== MULTICALL ====================

  console.log('\n=== MULTICALL ===\n');

  console.log('5. Batch reading multiple trades...');

  const walletAddress = '0x...'; // Replace with actual address

  // Get trading storage contract
  const tradingStorage = client['contracts'].get('TradingStorage');

  if (tradingStorage) {
    // Batch read trades 0, 1, 2 for pair 0
    const trades = await client.multicall.batchGetOpenTrades(
      tradingStorage,
      walletAddress,
      0, // pairIndex
      [0, 1, 2] // trade indices
    );

    console.log('Fetched', trades.length, 'trades in a single call');
    trades.forEach((trade, i) => {
      console.log(`Trade ${i}:`, {
        openPrice: trade.openPrice.toString(),
        leverage: trade.leverage.toString(),
        buy: trade.buy,
      });
    });

    // Batch read trade infos
    console.log('\n6. Batch reading trade infos...');
    const tradeInfos = await client.multicall.batchGetOpenTradesInfo(
      tradingStorage,
      walletAddress,
      0,
      [0, 1, 2]
    );

    console.log('Fetched', tradeInfos.length, 'trade infos');
    tradeInfos.forEach((info, i) => {
      console.log(`Trade ${i} info:`, {
        openInterestUSDC: info.openInterestUSDC.toString(),
        lossProtection: info.lossProtection.toString(),
      });
    });
  }

  // ==================== CUSTOM MULTICALL ====================

  console.log('\n7. Custom multicall example...');

  // Get pair storage contract
  const pairStorage = client['contracts'].get('PairStorage');

  if (pairStorage) {
    // Read multiple pairs at once
    const pairs = await client.multicall.batchGetPairs(pairStorage, [0, 1, 2, 3, 4]);

    console.log('Fetched', pairs.length, 'pairs');
    pairs.forEach((pair, i) => {
      console.log(`Pair ${i}:`, {
        from: pair.from,
        to: pair.to,
        maxLeverage: pair.maxLeverage.toString(),
      });
    });
  }

  // Advanced: Manual multicall with custom calls
  console.log('\n8. Manual multicall with different contracts...');

  const pairInfos = client['contracts'].get('PairInfos');
  const referral = client['contracts'].get('Referral');

  if (pairInfos && referral && tradingStorage) {
    const result = await client.multicall.aggregateAndDecode([
      {
        contract: pairInfos,
        functionName: 'onePercentDepthAboveUsdc',
        args: [0],
      },
      {
        contract: pairInfos,
        functionName: 'onePercentDepthBelowUsdc',
        args: [0],
      },
      {
        contract: tradingStorage,
        functionName: 'openInterestUsdc',
        args: [0, 0],
      },
    ]);

    console.log('Block number:', result.blockNumber);
    console.log('Depth above:', result.results[0].toString());
    console.log('Depth below:', result.results[1].toString());
    console.log('Open interest:', result.results[2].toString());
  }
}

// Run the example
main().catch(console.error);
