/**
 * PERPS TRADING SYSTEM TEST
 * 
 * Tests both price-feed-server (port 3001) and debonk-server (port 5119)
 * 
 * Run: npx tsx test-perps.ts
 */

const PRICE_FEED_SERVER = 'http://localhost:3001';
const DEBONK_SERVER = 'http://localhost:5119';
const TEST_TELEGRAM_ID = '123456789';

let positionId: string | null = null;

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message: string) {
  log(`✅ ${message}`, colors.green);
}

function logError(message: string) {
  log(`❌ ${message}`, colors.red);
}

function logInfo(message: string) {
  log(`ℹ️  ${message}`, colors.cyan);
}

function logWarning(message: string) {
  log(`⚠️  ${message}`, colors.yellow);
}

function logStep(step: number, message: string) {
  log(`\n${'='.repeat(60)}`, colors.blue);
  log(`STEP ${step}: ${message}`, colors.bright);
  log('='.repeat(60), colors.blue);
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Test 1: Price Feed Server Health
async function testPriceFeedHealth() {
  logStep(1, 'Testing Price Feed Server Health');
  
  try {
    const response = await fetch(`${PRICE_FEED_SERVER}/health`);
    const data = await response.json() as { status: string; pythConnected: boolean; supportedPairs: string };
    
    logInfo(`Status: ${data.status}`);
    logInfo(`Pyth Connected: ${data.pythConnected}`);
    logInfo(`Supported Pairs: ${data.supportedPairs}`);
    
    if (data.status === 'ok' && data.pythConnected) {
      logSuccess('Price Feed Server is healthy!');
      return true;
    } else {
      logError('Price Feed Server health check failed');
      return false;
    }
  } catch (error: any) {
    logError(`Price Feed Server not responding: ${error.message}`);
    return false;
  }
}

// Test 2: Get Categorized Pairs
async function testCategorizedPairs() {
  logStep(2, 'Testing Categorized Pairs Endpoint');
  
  try {
    const response = await fetch(`${PRICE_FEED_SERVER}/pairs`);
    const data = await response.json() as { totalPairs: number; categories: { [key: string]: { name: string; count: number; description: string; pairs: string[] } } };
    
    logInfo(`Total Pairs: ${data.totalPairs}`);
    logInfo('\nCategories:');
    
    Object.entries(data.categories).forEach(([key, category]: [string, any]) => {
      log(`  ${category.name} (${category.count} pairs)`, colors.cyan);
      log(`    ${category.description}`, colors.reset);
      log(`    Sample: ${category.pairs.slice(0, 3).join(', ')}...`, colors.reset);
    });
    
    logSuccess('Successfully fetched categorized pairs!');
    return true;
  } catch (error: any) {
    logError(`Failed to fetch pairs: ${error.message}`);
    return false;
  }
}

// Test 3: Get BTC Price
async function testBTCPrice() {
  logStep(3, 'Testing BTC/USD Price Fetch');
  
  try {
    const response = await fetch(`${PRICE_FEED_SERVER}/price/BTC%2FUSD`);
    const data = await response.json() as { pair: string; price: number; confidence: number; publishTime: number };
    
    logInfo(`Pair: ${data.pair}`);
    logInfo(`Price: $${data.price.toFixed(2)}`);
    logInfo(`Confidence: ±$${data.confidence}`);
    logInfo(`Publish Time: ${data.publishTime}`);
    
    if (data.price > 0) {
      logSuccess('Successfully fetched BTC price!');
      return data.price;
    } else {
      logError('BTC price is 0 or invalid');
      return null;
    }
  } catch (error: any) {
    logError(`Failed to fetch BTC price: ${error.message}`);
    return null;
  }
}

// Test 4: Debonk Server Health
async function testDebonkHealth() {
  logStep(4, 'Testing Debonk Server Health');
  
  try {
    const response = await fetch(`${DEBONK_SERVER}/health`);
    const data = await response.json() as { status: string; timestamp: string };
    
    logInfo(`Status: ${data.status}`);
    logInfo(`Timestamp: ${data.timestamp}`);
    
    if (data.status === 'ok') {
      logSuccess('Debonk Server is healthy!');
      return true;
    } else {
      logError('Debonk Server health check failed');
      return false;
    }
  } catch (error: any) {
    logError(`Debonk Server not responding: ${error.message}`);
    return false;
  }
}

// Test 5: Get Perp Balance
async function testPerpBalance() {
  logStep(5, 'Testing Perp Balance');
  
  try {
    const response = await fetch(`${DEBONK_SERVER}/api/perp/balance/${TEST_TELEGRAM_ID}`);
    const data = await response.json() as { telegramId: string; perpBalance: string; currency: string; success: boolean };
    
    logInfo(`Telegram ID: ${data.telegramId}`);
    logInfo(`Balance: $${data.perpBalance}`);
    logInfo(`Currency: ${data.currency}`);
    
    if (data.success && parseFloat(data.perpBalance) > 0) {
      logSuccess(`Perp balance: $${data.perpBalance}`);
      return parseFloat(data.perpBalance);
    } else {
      logError('Failed to fetch perp balance');
      return null;
    }
  } catch (error: any) {
    logError(`Failed to fetch perp balance: ${error.message}`);
    return null;
  }
}

// Test 6: Open Perp Position
async function testOpenPosition(btcPrice: number) {
  logStep(6, 'Testing Open Perp Position');
  
  const payload = {
    pair: 'BTC/USD',
    isLong: true,
    collateral: 50,
    leverage: 10,
    entryPrice: btcPrice,
    chain: 'base'
  };
  
  logInfo(`Opening LONG position:`);
  logInfo(`  Pair: ${payload.pair}`);
  logInfo(`  Collateral: $${payload.collateral}`);
  logInfo(`  Leverage: ${payload.leverage}x`);
  logInfo(`  Entry Price: $${payload.entryPrice.toFixed(2)}`);
  logInfo(`  Position Size: $${payload.collateral * payload.leverage}`);
  
  try {
    const response = await fetch(`${DEBONK_SERVER}/api/perp/open/${TEST_TELEGRAM_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json() as { success: boolean; position: { id: string; status: string }; newPerpBalance: number; error?: string };
    
    if (data.success) {
      positionId = data.position.id;
      logInfo(`Position ID: ${positionId}`);
      logInfo(`Status: ${data.position.status}`);
      logInfo(`New Balance: $${data.newPerpBalance}`);
      logSuccess('Position opened successfully!');
      return positionId;
    } else {
      logError(`Failed to open position: ${data.error}`);
      return null;
    }
  } catch (error: any) {
    logError(`Failed to open position: ${error.message}`);
    return null;
  }
}

// Test 7: Get Open Positions
async function testGetPositions() {
  logStep(7, 'Testing Get Open Positions');
  
  try {
    const response = await fetch(`${DEBONK_SERVER}/api/perp/positions/${TEST_TELEGRAM_ID}?status=OPEN`);
    const data = await response.json() as { positions: Array<{ id: string; pair: string; isLong: boolean; collateral: number; leverage: number; entryPrice: number; positionSize: number; currentPnL: number; status: string }> };
    
    logInfo(`Found ${data.positions.length} open position(s)`);
    
    data.positions.forEach((pos: any, index: number) => {
      log(`\nPosition ${index + 1}:`, colors.cyan);
      logInfo(`  ID: ${pos.id}`);
      logInfo(`  Pair: ${pos.pair}`);
      logInfo(`  Type: ${pos.isLong ? 'LONG' : 'SHORT'}`);
      logInfo(`  Collateral: $${pos.collateral}`);
      logInfo(`  Leverage: ${pos.leverage}x`);
      logInfo(`  Entry Price: $${pos.entryPrice}`);
      logInfo(`  Position Size: $${pos.positionSize}`);
      logInfo(`  Current PnL: $${pos.currentPnL}`);
      logInfo(`  Status: ${pos.status}`);
    });
    
    if (data.positions.length > 0) {
      logSuccess('Successfully fetched positions!');
      return true;
    } else {
      logWarning('No open positions found');
      return false;
    }
  } catch (error: any) {
    logError(`Failed to fetch positions: ${error.message}`);
    return false;
  }
}

// Test 8: Close Position
async function testClosePosition(exitPrice: number) {
  logStep(8, 'Testing Close Perp Position');
  
  if (!positionId) {
    logError('No position ID available to close');
    return false;
  }
  
  const payload = {
    exitPrice: exitPrice,
    telegramId: TEST_TELEGRAM_ID
  };
  
  logInfo(`Closing position ${positionId}`);
  logInfo(`Exit Price: $${exitPrice.toFixed(2)}`);
  
  try {
    const response = await fetch(`${DEBONK_SERVER}/api/perp/close/${positionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json() as { success: boolean; position: { entryPrice: number; exitPrice: number; realizedPnL: string }; newPerpBalance: number; error?: string };
    
    if (data.success) {
      logInfo(`Entry Price: $${data.position.entryPrice}`);
      logInfo(`Exit Price: $${data.position.exitPrice}`);
      logInfo(`Realized PnL: $${data.position.realizedPnL}`);
      logInfo(`New Balance: $${data.newPerpBalance}`);
      
      const pnl = parseFloat(data.position.realizedPnL);
      if (pnl > 0) {
        logSuccess(`Position closed with PROFIT: $${pnl.toFixed(2)}! 💰`);
      } else if (pnl < 0) {
        logWarning(`Position closed with LOSS: $${pnl.toFixed(2)} 📉`);
      } else {
        logInfo('Position closed with no profit/loss');
      }
      
      return true;
    } else {
      logError(`Failed to close position: ${data.error}`);
      return false;
    }
  } catch (error: any) {
    logError(`Failed to close position: ${error.message}`);
    return false;
  }
}

// Test 9: WebSocket Connection
async function testWebSocket() {
  logStep(9, 'Testing WebSocket Real-Time Prices');
  
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket(`ws://localhost:3001/prices`);
      let messageCount = 0;
      
      ws.onopen = () => {
        logSuccess('WebSocket connected!');
        logInfo('Subscribing to BTC/USD...');
        ws.send(JSON.stringify({ type: 'subscribe', pair: 'BTC/USD' }));
      };
      
      ws.onmessage = (event: any) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'connected') {
          logInfo(`Connected to price feed`);
        } else if (data.type === 'subscribed') {
          logInfo(`Subscribed to ${data.pair}`);
        } else if (data.type === 'price_update') {
          messageCount++;
          logInfo(`Price Update ${messageCount}: ${data.pair} = $${data.data.price.toFixed(2)}`);
          
          if (messageCount >= 3) {
            logSuccess('WebSocket price updates working!');
            ws.close();
            resolve(true);
          }
        }
      };
      
      ws.onerror = (error: any) => {
        logError(`WebSocket error: ${error.message}`);
        resolve(false);
      };
      
      ws.onclose = () => {
        logInfo('WebSocket closed');
      };
      
      // Timeout after 10 seconds
      setTimeout(() => {
        if (messageCount === 0) {
          logWarning('No price updates received within 10 seconds');
          ws.close();
          resolve(false);
        }
      }, 10000);
    } catch (error: any) {
      logError(`WebSocket test failed: ${error.message}`);
      resolve(false);
    }
  });
}

// Main Test Runner
async function runTests() {
  log('\n' + '='.repeat(60), colors.bright);
  log('🧪 PERPS TRADING SYSTEM - COMPLETE TEST SUITE', colors.bright);
  log('='.repeat(60) + '\n', colors.bright);
  
  const results: { [key: string]: boolean } = {};
  
  // Test Price Feed Server
  results.priceFeedHealth = await testPriceFeedHealth();
  if (!results.priceFeedHealth) {
    logError('Price Feed Server is not running! Start it with: npm run dev');
    return;
  }
  
  await sleep(500);
  results.categorizedPairs = await testCategorizedPairs();
  
  await sleep(500);
  const btcPrice = await testBTCPrice();
  results.btcPrice = btcPrice !== null;
  
  // Test Debonk Server
  await sleep(500);
  results.debonkHealth = await testDebonkHealth();
  if (!results.debonkHealth) {
    logError('Debonk Server is not running! Start it with: npm run dev');
    return;
  }
  
  await sleep(500);
  const balance = await testPerpBalance();
  results.perpBalance = balance !== null;
  
  if (balance && balance >= 50 && btcPrice) {
    await sleep(500);
    const openedPositionId = await testOpenPosition(btcPrice);
    results.openPosition = openedPositionId !== null;
    
    await sleep(500);
    results.getPositions = await testGetPositions();
    
    await sleep(2000); // Wait 2 seconds before closing
    
    // Close with a slightly higher price for profit
    const exitPrice = btcPrice * 1.02; // 2% profit
    results.closePosition = await testClosePosition(exitPrice);
  } else {
    logWarning('Skipping position tests (insufficient balance or no BTC price)');
    results.openPosition = false;
    results.getPositions = false;
    results.closePosition = false;
  }
  
  await sleep(500);
  results.websocket = await testWebSocket() as boolean;
  
  // Summary
  log('\n' + '='.repeat(60), colors.bright);
  log('📊 TEST RESULTS SUMMARY', colors.bright);
  log('='.repeat(60) + '\n', colors.bright);
  
  const testNames = {
    priceFeedHealth: 'Price Feed Server Health',
    categorizedPairs: 'Categorized Pairs',
    btcPrice: 'BTC Price Fetch',
    debonkHealth: 'Debonk Server Health',
    perpBalance: 'Perp Balance',
    openPosition: 'Open Position',
    getPositions: 'Get Positions',
    closePosition: 'Close Position',
    websocket: 'WebSocket Real-Time'
  };
  
  let passed = 0;
  let failed = 0;
  
  Object.entries(results).forEach(([key, result]) => {
    const name = testNames[key as keyof typeof testNames];
    if (result) {
      logSuccess(`${name}`);
      passed++;
    } else {
      logError(`${name}`);
      failed++;
    }
  });
  
  log('\n' + '='.repeat(60), colors.bright);
  log(`Total Tests: ${passed + failed}`, colors.bright);
  logSuccess(`Passed: ${passed}`);
  if (failed > 0) {
    logError(`Failed: ${failed}`);
  }
  log('='.repeat(60) + '\n', colors.bright);
  
  if (passed === Object.keys(results).length) {
    log('🎉 ALL TESTS PASSED! PERPS SYSTEM IS WORKING! 🚀', colors.green + colors.bright);
  } else {
    log('⚠️  Some tests failed. Check the logs above.', colors.yellow);
  }
}

// Run tests
runTests().catch(console.error);