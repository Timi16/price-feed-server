/**
 * WebSocket Debug Test - Direct Pyth Connection
 * This will show us EXACTLY what Pyth is sending
 * Run: npx tsx ws-debug-test.ts
 */

import WebSocket from 'ws';

const PYTH_WS_URL = 'wss://hermes.pyth.network/ws';
const BTC_FEED_ID = '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43';

console.log('🔍 Direct Pyth WebSocket Debug Test\n');
console.log(`Feed ID: ${BTC_FEED_ID}`);
console.log(`Lowercase: ${BTC_FEED_ID.toLowerCase()}\n`);

const ws = new WebSocket(PYTH_WS_URL);

ws.on('open', () => {
  console.log('✅ WebSocket connected\n');
  
  // Test 1: Subscribe with original case
  console.log('📤 Subscribing with ORIGINAL case (0x prefix)...');
  ws.send(JSON.stringify({
    type: 'subscribe',
    ids: [BTC_FEED_ID]
  }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  
  console.log('\n📨 Received message:');
  console.log('Type:', message.type);
  
  if (message.type === 'response') {
    console.log('Full response:', JSON.stringify(message, null, 2));
  }
  
  if (message.type === 'price_update') {
    console.log('✅ PRICE UPDATE RECEIVED!');
    console.log('Feed ID from Pyth:', message.price_feed.id);
    console.log('Our Feed ID:', BTC_FEED_ID);
    console.log('Match (exact):', message.price_feed.id === BTC_FEED_ID);
    console.log('Match (lowercase):', message.price_feed.id.toLowerCase() === BTC_FEED_ID.toLowerCase());
    
    const price = Number(message.price_feed.price.price) * Math.pow(10, message.price_feed.price.expo);
    console.log('Price:', price.toFixed(2));
    
    // Success - we got a price update
    console.log('\n🎉 SUCCESS! WebSocket is working!');
    process.exit(0);
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error);
  process.exit(1);
});

ws.on('close', () => {
  console.log('\n⚠️ WebSocket closed');
});

// Timeout after 20 seconds
setTimeout(() => {
  console.error('\n❌ TIMEOUT: No price updates received in 20 seconds');
  console.log('\nThis suggests either:');
  console.log('1. Pyth is not sending updates for this feed ID');
  console.log('2. The subscription is not being accepted');
  console.log('3. The feed ID format is incorrect');
  ws.close();
  process.exit(1);
}, 20000);