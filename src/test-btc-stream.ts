/**
 * BTC Price Stream
 * Continuously streams real-time BTC/USD prices from Pyth Network
 * Run: npx tsx btc-price-stream.ts
 */

import WebSocket from 'ws';

const PYTH_WS_URL = 'wss://hermes.pyth.network/ws';
// BTC/USD feed ID from Pyth
const BTC_FEED_ID = 'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43';

function formatPrice(price: string, expo: number): string {
  const priceNum = Number(price);
  const actualPrice = priceNum * Math.pow(10, expo);
  return actualPrice.toFixed(2);
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleTimeString();
}

async function streamBTCPrice() {
  console.log('🚀 Starting BTC/USD Price Stream...');
  console.log('═'.repeat(70));
  console.log('Press Ctrl+C to stop\n');

  const ws = new WebSocket(PYTH_WS_URL);

  ws.on('open', () => {
    console.log('✅ Connected to Pyth Network\n');
    
    // Subscribe to BTC/USD feed
    ws.send(JSON.stringify({
      type: 'subscribe',
      ids: [BTC_FEED_ID]
    }));
  });

  ws.on('message', (data: Buffer) => {
    try {
      const msg = JSON.parse(data.toString());
      
      if (msg.type === 'price_update') {
        const feed = msg.price_feed;
        const price = formatPrice(feed.price.price, feed.price.expo);
        const timestamp = formatTimestamp(feed.price.publish_time);
        const conf = formatPrice(feed.price.conf, feed.price.expo);
        
        console.log(`[${timestamp}] BTC/USD: $${price} (±$${conf})`);
      }
    } catch (error) {
      console.error('❌ Error parsing message:', error);
    }
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
  });

  ws.on('close', () => {
    console.log('\n❌ Connection closed. Reconnecting in 5 seconds...');
    setTimeout(streamBTCPrice, 5000);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n👋 Stopping price stream...');
    ws.close();
    process.exit(0);
  });
}

streamBTCPrice();