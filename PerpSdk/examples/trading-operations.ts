/**
 * Trading Operations Example
 * Demonstrates opening trades, closing trades, and updating positions
 */

import { TraderClient, TradeInputOrderType, MarginUpdateType } from '../src';

async function main() {
  // Initialize client (Base network)
  const client = new TraderClient('https://mainnet.base.org');

  // Set signer with private key
  const privateKey = process.env.PRIVATE_KEY || '0x...';
  client.setLocalSigner(privateKey);

  const walletAddress = await client.signer?.getAddress();
  console.log('Wallet address:', walletAddress);

  // ==================== OPEN A TRADE ====================

  console.log('\n1. Opening a trade...');

  // Get execution fee
  const executionFee = await client.tradingOps.getExecutionFee();
  console.log('Execution fee:', executionFee, 'ETH');

  // Define trade parameters
  const trade = {
    trader: walletAddress!,
    pairIndex: 0, // BTC/USD
    index: 0, // Will be assigned by contract
    initialPosToken: 100, // 100 USDC collateral
    positionSizeUSDC: 100,
    openPrice: 50000, // $50,000 BTC price
    buy: true, // Long position
    leverage: 10, // 10x leverage
    tp: 55000, // Take profit at $55,000
    sl: 48000, // Stop loss at $48,000
  };

  const slippagePercent = 1; // 1% slippage tolerance

  try {
    const receipt = await client.tradingOps.openTrade(
      trade,
      TradeInputOrderType.MARKET,
      slippagePercent,
      executionFee
    );

    console.log('Trade opened! Transaction hash:', receipt?.hash);
  } catch (error) {
    console.error('Error opening trade:', error);
  }

  // ==================== QUERY OPEN TRADES ====================

  console.log('\n2. Querying open trades...');

  const tradeCount = await client.tradingOps.getOpenTradesCount(walletAddress!, 0);
  console.log('Number of open trades:', tradeCount);

  if (tradeCount > 0) {
    // Get first trade
    const openTrade = await client.tradingOps.getOpenTrade(walletAddress!, 0, 0);
    console.log('Open trade:', {
      leverage: openTrade.leverage,
      openPrice: openTrade.openPrice,
      tp: openTrade.tp,
      sl: openTrade.sl,
      isLong: openTrade.buy,
    });

    // Get additional trade info
    const tradeInfo = await client.tradingOps.getOpenTradeInfo(walletAddress!, 0, 0);
    console.log('Trade info:', {
      openInterestUSDC: tradeInfo.openInterestUSDC,
      lossProtection: tradeInfo.lossProtection,
    });
  }

  // ==================== UPDATE TP/SL ====================

  console.log('\n3. Updating take profit and stop loss...');

  try {
    const receipt = await client.tradingOps.updateTpAndSl(
      0, // pairIndex
      0, // tradeIndex
      47000, // New SL: $47,000
      56000, // New TP: $56,000
      [] // Price update data (can be empty for now)
    );

    console.log('TP/SL updated! Transaction hash:', receipt?.hash);
  } catch (error) {
    console.error('Error updating TP/SL:', error);
  }

  // ==================== UPDATE MARGIN ====================

  console.log('\n4. Adding margin to position...');

  try {
    const receipt = await client.tradingOps.updateMargin(
      0, // pairIndex
      0, // tradeIndex
      MarginUpdateType.DEPOSIT,
      50, // Add 50 USDC
      []
    );

    console.log('Margin updated! Transaction hash:', receipt?.hash);
  } catch (error) {
    console.error('Error updating margin:', error);
  }

  // ==================== CLOSE TRADE ====================

  console.log('\n5. Closing trade...');

  try {
    const receipt = await client.tradingOps.closeTradeMarket(
      0, // pairIndex
      0, // tradeIndex
      150, // Close 150 USDC worth (full position if that's the total)
      executionFee
    );

    console.log('Trade closed! Transaction hash:', receipt?.hash);
  } catch (error) {
    console.error('Error closing trade:', error);
  }

  // ==================== LIMIT ORDERS ====================

  console.log('\n6. Checking limit orders...');

  try {
    const limitOrder = await client.tradingOps.getOpenLimitOrder(walletAddress!, 0, 0);
    console.log('Limit order:', limitOrder);
  } catch (error) {
    // No limit order exists
    console.log('No limit order found');
  }
}

// Run the example
main().catch(console.error);
