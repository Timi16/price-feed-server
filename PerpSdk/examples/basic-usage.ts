/**
 * Basic usage example for Avantis Trader SDK
 */

import { FeedClient, PriceFeedResponse, TraderClient, TradeInput, TradeInputOrderType } from '../src';

async function getBtcPriceFromPyth(client: TraderClient): Promise<number> {
  const btcPairIndex = await client.pairsCache.getPairIndex('BTC/USD');
  if (btcPairIndex === undefined) {
    throw new Error('BTC/USD pair not found');
  }

  const pairData = await client.pairsCache.getPairBackend(btcPairIndex);
  const btcFeedId = pairData.pair.feed.feedId;
  const feedClient = new FeedClient();

  return await new Promise<number>(async (resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      feedClient.close();
      reject(new Error('Timed out waiting for BTC/USD price from Pyth'));
    }, 15000);

    const onPriceUpdate = (priceData: PriceFeedResponse) => {
      if (settled) return;

      const price = Number(priceData.price.price) * Math.pow(10, priceData.price.expo);
      if (!Number.isFinite(price) || price <= 0) return;

      settled = true;
      clearTimeout(timeout);
      feedClient.unregisterPriceFeedCallback(btcFeedId, onPriceUpdate);
      feedClient.close();
      resolve(price);
    };

    try {
      feedClient.registerPriceFeedCallback(btcFeedId, onPriceUpdate);
      await feedClient.listenForPriceUpdates();
    } catch (error) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      feedClient.close();
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

async function main() {
  // Initialize client with your RPC endpoint
  const providerUrl = 'https://base-rpc.publicnode.com';
  const client = new TraderClient(providerUrl);

  // Set up signer with your private key (for local development)
  const privateKey = '';
  client.setLocalSigner(privateKey);

  // Get your address
  const address = await client.signer?.getAddress();
  console.log('Trading from address:', address);

  // Check USDC balance
  const usdcBalance = await client.getUsdcBalance(address!);
  console.log('USDC Balance:', usdcBalance);

  // Check USDC allowance
  const allowance = await client.getUsdcAllowanceForTrading(address!);
  console.log('USDC Allowance:', allowance);

  // Approve USDC if needed
  if (allowance < 1000) {
    console.log('Approving USDC...');
    const approvalReceipt = await client.approveUsdcForTrading(10000); // Approve 10,000 USDC
    console.log('Approval transaction hash:', approvalReceipt?.hash);

    // Check allowance again after approval
    const newAllowance = await client.getUsdcAllowanceForTrading(address!);
    console.log('New USDC Allowance after approval:', newAllowance);
  }

  // Get market snapshot
  // console.log('Fetching market snapshot...');
  // const snapshot = await client.snapshotRPC.getSnapshot();
  // console.log('Snapshot:', JSON.stringify(snapshot, null, 2));

  // Get pair data
  // const btcPair = await client.snapshotRPC.getPairSnapshot('BTC/USD');
  // console.log('BTC/USD data:', btcPair);

  console.log('Fetching BTC/USD price from Pyth...');
  const btcOpenPrice = await getBtcPriceFromPyth(client);
  console.log('BTC/USD Pyth price:', btcOpenPrice);

  // Create a trade
  const tradeInput: TradeInput = {
    pair: 'BTC/USD',
    isLong: true,
    collateralInTrade: 3, // 3 USDC (leave room for fees)
    leverage: 5, // 10x leverage
    openPrice: btcOpenPrice,
    tp: 0, // Take profit (0 = none)
    sl: 0, // Stop loss (0 = none)
    orderType: TradeInputOrderType.MARKET_ZERO_FEE,
    timestamp: Date.now(),
    maxSlippageP: 3, // 1% max slippage
    referrer: "0xca4d3f16a1deef067875ec01a9f683f67a91d947"
  };

  // Build trade transaction
  console.log('Building trade transaction...');
  const tradeTx = await client.tradeRPC.buildTradeOpenTx(tradeInput, address!);
//sinulate transaction to check for errors before sending
  console.log('Simulating trade transaction...');
  try {
    await client.simulateTransaction(tradeTx);
    console.log('Simulation successful, no errors detected.');
  } catch (error) {
    console.error('Simulation failed:', error);
    return;
  }


  // Sign and send transaction
  console.log('Sending trade...');
  const receipt = await client.signAndGetReceipt(tradeTx);
  console.log('Trade executed! Transaction hash:', receipt?.hash);
  const trades = await client.tradeRPC.getTrades(address!);
  console.log('Open trades:', trades);

  const tradeId = trades[0]?.index;
  await waitForIt(5000); // Wait for a few seconds to ensure the trade is processed

  //then close some part of the position
const partialCloseTx = await client.tradeRPC.buildTradeMarginUpdateTx(1,tradeId,)

  // Get your open trades
}

const waitForIt = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Run the example
main().catch(console.error);
