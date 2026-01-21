/**
 * Price feed example - Get Pyth IDs from SDK and use with FeedClient
 *
 * This example demonstrates how to:
 * 1. Fetch Pyth feed IDs from the trading pair storage contract
 * 2. Use those IDs with the FeedClient to get real-time price updates
 */

import { TraderClient, FeedClient, PriceFeedResponse } from '../src';

async function main() {
  // Initialize the trading client
  const providerUrl = 'https://base-rpc.publicnode.com';
  const client = new TraderClient(providerUrl);

  // Example 1: Get Pyth feed ID for a specific pair
  console.log('=== Example 1: Get Pyth ID for BTC/USD ===');

  // Get BTC/USD pair index
  const btcPairIndex = await client.pairsCache.getPairIndex('BTC/USD');
  console.log('BTC/USD pair index:', btcPairIndex);

  if (btcPairIndex !== undefined) {
    // Get the full pair backend data (includes feed IDs)
    const pairData = await client.pairsCache.getPairBackend(btcPairIndex);

    console.log('Primary Pyth Feed ID:', pairData.pair.feed.feedId);
    console.log('Backup Feed ID (Chainlink):', pairData.pair.backupFeed.feedId);
    console.log('Max Open Deviation:', pairData.pair.feed.maxOpenDeviationP);
    console.log('Max Close Deviation:', pairData.pair.feed.maxCloseDeviationP);
  }

  // Example 2: Get Pyth IDs for ALL trading pairs
  console.log('\n=== Example 2: Get Pyth IDs for all pairs ===');

  const allPairs = await client.pairsCache.getPairsInfo();
  const pairFeedsMap = new Map<string, string>();

  for (const [pairIndex, pairInfo] of allPairs) {
    // Get the full backend data for this pair
    const pairData = await client.pairsCache.getPairBackend(pairIndex);
    const pairName = `${pairInfo.from}/${pairInfo.to}`;
    const feedId = pairData.pair.feed.feedId;

    pairFeedsMap.set(pairName, feedId);
    console.log(`${pairName}: ${feedId}`);
  }

  // Example 3: Use the Pyth IDs with FeedClient for real-time prices
  console.log('\n=== Example 3: Connect to Pyth for real-time prices ===');

  const feedClient = new FeedClient();

  // Load the pair-to-feed mapping into FeedClient
  feedClient.loadPairFeeds(pairFeedsMap);

  // Register callbacks for specific pairs
  const btcFeedId = feedClient.getFeedIdForPair('BTC/USD');
  const ethFeedId = feedClient.getFeedIdForPair('ETH/USD');

  if (btcFeedId) {
    console.log('Registering callback for BTC/USD feed:', btcFeedId);
    feedClient.registerPriceFeedCallback(btcFeedId, (priceData: PriceFeedResponse) => {
      const price = Number(priceData.price.price) * Math.pow(10, priceData.price.expo);
      console.log('BTC/USD Price Update:', {
        price: price.toFixed(2),
        confidence: priceData.price.conf,
        timestamp: new Date(priceData.price.publishTime * 1000).toISOString(),
      });
    });
  }

  if (ethFeedId) {
    console.log('Registering callback for ETH/USD feed:', ethFeedId);
    feedClient.registerPriceFeedCallback(ethFeedId, (priceData: PriceFeedResponse) => {
      const price = Number(priceData.price.price) * Math.pow(10, priceData.price.expo);
      console.log('ETH/USD Price Update:', {
        price: price.toFixed(2),
        confidence: priceData.price.conf,
        timestamp: new Date(priceData.price.publishTime * 1000).toISOString(),
      });
    });
  }

  // Connect to Pyth WebSocket and start receiving updates
  console.log('\nConnecting to Pyth Network WebSocket...');
  await feedClient.listenForPriceUpdates();

  console.log('Connected! Listening for price updates...');
  console.log('Press Ctrl+C to exit');

  // Keep the process running
  process.stdin.resume();
}

// Run the example
main().catch(console.error);
