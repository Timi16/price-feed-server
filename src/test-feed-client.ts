/**
 * Direct test of FeedClient to verify it's working
 * Run: npx tsx test-feed-client.ts
 */

import { FeedClient } from '@perpsdk/feed/feed_client';
import { TraderClient } from '@perpsdk/client';

const PYTH_WS_URL = 'wss://hermes.pyth.network/ws';  // ← CHANGE https → wss
const BASE_RPC_URL = 'https://base.meowrpc.com';

async function testFeedClient() {
  console.log('🧪 Testing FeedClient directly...\n');

  try {
    // Get BTC feed ID
    console.log('1️⃣ Getting BTC/USD feed ID...');
    const traderClient = new TraderClient(BASE_RPC_URL);
    const allPairs = await traderClient.pairsCache.getPairsInfo();
    
    let btcFeedId: string | null = null;
    for (const [pairIndex, pairInfo] of allPairs) {
      if (pairInfo.from === 'BTC' && pairInfo.to === 'USD') {
        const pairData = await traderClient.pairsCache.getPairBackend(pairIndex);
        btcFeedId = pairData.pair.feed.feedId;
        console.log(`✅ Found BTC/USD feed ID: ${btcFeedId}\n`);
        break;
      }
    }

    if (!btcFeedId) {
      throw new Error('Could not find BTC/USD feed ID');
    }

    // Test FeedClient
    console.log('2️⃣ Connecting to Pyth WebSocket...');
    const feedClient = new FeedClient(
      PYTH_WS_URL,
      (error) => {
        console.error('❌ FeedClient error:', error);
      },
      () => {
        console.log('⚠️ FeedClient connection closed');
      }
    );

    await feedClient.listenForPriceUpdates();
    console.log('✅ Connected to Pyth\n');

    // Register callback
    console.log('3️⃣ Registering callback for BTC/USD...');
    let updateCount = 0;
    
    feedClient.registerPriceFeedCallback(btcFeedId, (priceFeed: any) => {
      updateCount++;
      const price = Number(priceFeed.price.price) * Math.pow(10, priceFeed.price.expo);
      console.log(`📊 Update ${updateCount}: BTC/USD = $${price.toFixed(2)}`);
      
      if (updateCount >= 3) {
        console.log('\n✅ SUCCESS! Received 3 price updates');
        process.exit(0);
      }
    });

    console.log('✅ Callback registered. Waiting for price updates...\n');

    // Timeout after 15 seconds
    setTimeout(() => {
      if (updateCount === 0) {
        console.error('❌ FAILED: No price updates received after 15 seconds');
        console.log('\nPossible issues:');
        console.log('- Pyth WebSocket URL might be incorrect');
        console.log('- Feed ID might be wrong');
        console.log('- FeedClient might not be properly triggering callbacks');
        process.exit(1);
      }
    }, 15000);

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testFeedClient();