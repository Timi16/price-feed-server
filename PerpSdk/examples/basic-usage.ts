/**
 * Basic usage example for Avantis Trader SDK
 */

import { TraderClient, TradeInput, TradeInputOrderType } from '../src';

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

  // // Get market snapshot
  // console.log('Fetching market snapshot...');
  // const snapshot = await client.snapshotRPC.getSnapshot();
  // console.log('Snapshot:', JSON.stringify(snapshot, null, 2));

  // // Get pair data
  // const btcPair = await client.snapshotRPC.getPairSnapshot('BTC/USD');
  // console.log('BTC/USD data:', btcPair);

  // Create a trade
  const tradeInput: TradeInput = {
    pair: 'BTC/USD',
    isLong: true,
    collateralInTrade: 2, // 3 USDC (leave room for fees)
    leverage: 10, // 10x leverage
    openPrice: 0, // 0 = market order
    tp: 0, // Take profit (0 = none)
    sl: 0, // Stop loss (0 = none)
    orderType: TradeInputOrderType.MARKET,

    maxSlippageP: 1, // 1% max slippage
    referrer: "0xca4d3f16a1deef067875ec01a9f683f67a91d947"
  };

  // // Build trade transaction
  // console.log('Building trade transaction...');
  // const tradeTx = await client.tradeRPC.buildTradeOpenTx(tradeInput, address!);

  // // Sign and send transaction
  // console.log('Sending trade...');
  // const receipt = await client.signAndGetReceipt(tradeTx);
  // console.log('Trade executed! Transaction hash:', receipt?.hash);

  // Get your open trades
  const trades = await client.tradeRPC.getTrades(address!);
  console.log('Open trades:', trades);
}

// Run the example
main().catch(console.error);
