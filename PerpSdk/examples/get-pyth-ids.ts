/**
 * Simple example - Get Pyth feed IDs from the SDK
 *
 * This shows how to retrieve Pyth feed IDs that are stored
 * in the trading pair storage contract.
 */

import { TraderClient } from '../src';

async function main() {
  // Initialize the trading client
  const providerUrl = 'https://base-rpc.publicnode.com';
  const client = new TraderClient(providerUrl);

  console.log('Fetching Pyth feed IDs from pair storage contract...\n');

  // Method 1: Get Pyth ID for a specific pair
  console.log('=== Method 1: Get Pyth ID for a specific pair ===');

  const btcPairIndex = await client.pairsCache.getPairIndex('BTC/USD');

  if (btcPairIndex !== undefined) {
    const btcPairData = await client.pairsCache.getPairBackend(btcPairIndex);

    console.log('Pair: BTC/USD');
    console.log('Pair Index:', btcPairIndex);
    console.log('Pyth Feed ID:', btcPairData.pair.feed.feedId);
    console.log('Backup Feed (Chainlink):', btcPairData.pair.backupFeed.feedId);
    console.log('');
  }

  // Method 2: Get ALL Pyth IDs as a map
  console.log('=== Method 2: Get all Pyth IDs ===');

  const allPairs = await client.pairsCache.getPairsInfo();
  const pythIds: Record<string, string> = {};

  for (const [pairIndex, pairInfo] of allPairs) {
    const pairData = await client.pairsCache.getPairBackend(pairIndex);
    const pairName = `${pairInfo.from}/${pairInfo.to}`;
    pythIds[pairName] = pairData.pair.feed.feedId;
  }

  console.log('All Pyth Feed IDs:');
  console.log(JSON.stringify(pythIds, null, 2));

  // Method 3: Export as CSV format (useful for documentation)
  console.log('\n=== Method 3: Export as CSV ===');
  console.log('Pair,PairIndex,PythFeedID,BackupFeedID');

  for (const [pairIndex, pairInfo] of allPairs) {
    const pairData = await client.pairsCache.getPairBackend(pairIndex);
    const pairName = `${pairInfo.from}/${pairInfo.to}`;
    console.log(
      `${pairName},${pairIndex},${pairData.pair.feed.feedId},${pairData.pair.backupFeed.feedId}`
    );
  }
}

// Run the example
main().catch(console.error);
