/**
 * Price feed example using WebSocket
 *
 * NOTE: For a complete example showing how to get Pyth feed IDs from the SDK,
 * see: price-feed-with-sdk-ids.ts
 */

import { FeedClient, PriceFeedResponse } from '../src';

async function main() {
  // Create feed client
  const feedClient = new FeedClient();

  // Register callback for BTC/USD price feed
  // You can get this ID from the SDK - see price-feed-with-sdk-ids.ts example
  const btcFeedId = 'your-btc-feed-id-here'; // Or use client.pairsCache.getPairBackend()

  feedClient.registerPriceFeedCallback(btcFeedId, (priceData: PriceFeedResponse) => {
    const price = Number(priceData.price.price) * Math.pow(10, priceData.price.expo);
    console.log('BTC/USD Price Update:', {
      price: price,
      confidence: priceData.price.conf,
      timestamp: new Date(priceData.price.publishTime * 1000).toISOString(),
    });
  });

  // Connect and listen for updates
  console.log('Connecting to price feed...');
  await feedClient.listenForPriceUpdates();

  // Keep the process running
  process.stdin.resume();
}

// Run the example
main().catch(console.error);
