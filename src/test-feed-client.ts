/**
 * Full System Diagnostic
 * This will test the ENTIRE flow from Pyth → FeedClient → PriceFeedService → WebSocket
 * Run: npx tsx full-diagnostic.ts
 */

import { FeedClient } from '@perpsdk/feed/feed_client';
import { TraderClient } from '@perpsdk/client';

const PYTH_WS_URL = 'wss://hermes.pyth.network/ws';
const BASE_RPC_URL = 'https://base-rpc.publicnode.com';

async function runDiagnostic() {
  console.log('🔍 FULL SYSTEM DIAGNOSTIC\n');
  console.log('═'.repeat(60));

  try {
    // Step 1: Get BTC feed ID from Avantis
    console.log('\n📋 STEP 1: Getting BTC/USD feed ID from Avantis...');
    const traderClient = new TraderClient(BASE_RPC_URL);
    const allPairs = await traderClient.pairsCache.getPairsInfo();
    
    let btcFeedId: string | null = null;
    for (const [pairIndex, pairInfo] of allPairs) {
      if (pairInfo.from === 'BTC' && pairInfo.to === 'USD') {
        const pairData = await traderClient.pairsCache.getPairBackend(pairIndex);
        btcFeedId = pairData.pair.feed.feedId;
        break;
      }
    }

    if (!btcFeedId) throw new Error('Could not find BTC/USD feed ID');
    
    console.log(`✅ Original feed ID: ${btcFeedId}`);
    
    // Normalize it
    let normalizedFeedId = btcFeedId.toLowerCase();
    if (normalizedFeedId.startsWith('0x')) {
      normalizedFeedId = normalizedFeedId.slice(2);
    }
    console.log(`✅ Normalized feed ID: ${normalizedFeedId}`);

    // Step 2: Test direct Pyth connection
    console.log('\n📋 STEP 2: Testing direct Pyth WebSocket...');
    const directWs = new WebSocket(PYTH_WS_URL);
    
    const directPythTest = await new Promise<boolean>((resolve) => {
      let gotUpdate = false;
      
      directWs.onopen = () => {
        console.log('✅ Connected to Pyth directly');
        console.log(`📤 Subscribing to: ${normalizedFeedId}`);
        directWs.send(JSON.stringify({
          type: 'subscribe',
          ids: [normalizedFeedId]
        }));
      };

      directWs.onmessage = (event: any) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'price_update') {
          console.log(`✅ Received price update from Pyth`);
          console.log(`   Feed ID: ${msg.price_feed.id}`);
          console.log(`   Matches normalized? ${msg.price_feed.id === normalizedFeedId}`);
          gotUpdate = true;
          directWs.close();
          resolve(true);
        }
      };

      setTimeout(() => {
        if (!gotUpdate) {
          console.error('❌ No price update from Pyth');
          directWs.close();
          resolve(false);
        }
      }, 10000);
    });

    if (!directPythTest) {
      console.error('❌ Direct Pyth test failed');
      return;
    }

    // Step 3: Test FeedClient
    console.log('\n📋 STEP 3: Testing FeedClient wrapper...');
    const feedClient = new FeedClient(PYTH_WS_URL);
    await feedClient.listenForPriceUpdates();
    console.log('✅ FeedClient connected');

    const feedClientTest = await new Promise<boolean>((resolve) => {
      let gotCallback = false;

      console.log(`📤 Registering callback for: ${normalizedFeedId}`);
      feedClient.registerPriceFeedCallback(normalizedFeedId, (priceFeed: any) => {
        console.log(`✅ FeedClient callback triggered!`);
        console.log(`   Feed ID: ${priceFeed.id}`);
        console.log(`   Price: ${Number(priceFeed.price.price) * Math.pow(10, priceFeed.price.expo)}`);
        gotCallback = true;
        feedClient.close();
        resolve(true);
      });

      setTimeout(() => {
        if (!gotCallback) {
          console.error('❌ FeedClient callback never triggered');
          feedClient.close();
          resolve(false);
        }
      }, 10000);
    });

    if (!feedClientTest) {
      console.error('❌ FeedClient test failed');
      return;
    }

    // Step 4: Test WebSocket server
    console.log('\n📋 STEP 4: Testing WebSocket server endpoint...');
    const ws = new WebSocket('ws://localhost:3001/prices');
    
    const wsServerTest = await new Promise<boolean>((resolve) => {
      let gotPriceUpdate = false;

      ws.onopen = () => {
        console.log('✅ Connected to price-feed-server WebSocket');
      };

      ws.onmessage = (event: any) => {
        const data = JSON.parse(event.data);
        console.log(`📨 Received: ${data.type}`);

        if (data.type === 'connected') {
          console.log('📤 Subscribing to BTC/USD...');
          ws.send(JSON.stringify({
            type: 'subscribe',
            pair: 'BTC/USD'
          }));
        }

        if (data.type === 'subscribed') {
          console.log('✅ Subscription confirmed');
        }

        if (data.type === 'price_update') {
          console.log('✅ Price update received!');
          console.log(`   Pair: ${data.pair}`);
          console.log(`   Price: $${data.data.price.toFixed(2)}`);
          gotPriceUpdate = true;
          ws.close();
          resolve(true);
        }
      };

      ws.onerror = (error: any) => {
        console.error('❌ WebSocket error:', error.message);
        resolve(false);
      };

      setTimeout(() => {
        if (!gotPriceUpdate) {
          console.error('❌ No price updates from WebSocket server');
          ws.close();
          resolve(false);
        }
      }, 15000);
    });

    // Final results
    console.log('\n═'.repeat(60));
    console.log('📊 DIAGNOSTIC RESULTS:');
    console.log('═'.repeat(60));
    console.log(`Direct Pyth:           ${directPythTest ? '✅' : '❌'}`);
    console.log(`FeedClient:            ${feedClientTest ? '✅' : '❌'}`);
    console.log(`WebSocket Server:      ${wsServerTest ? '✅' : '❌'}`);
    console.log('═'.repeat(60));

    if (directPythTest && feedClientTest && wsServerTest) {
      console.log('\n🎉 ALL TESTS PASSED! System is working correctly!');
    } else {
      console.log('\n⚠️ Some tests failed. Check the logs above.');
    }

    process.exit(wsServerTest ? 0 : 1);

  } catch (error) {
    console.error('\n❌ Diagnostic failed:', error);
    process.exit(1);
  }
}

runDiagnostic();