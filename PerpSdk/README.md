# Avantis Trader SDK - TypeScript

A comprehensive TypeScript SDK for interacting with the Avantis decentralized leveraged trading platform. This SDK enables developers to access real-time price feeds, retrieve asset parameters, integrate price updates into trading systems, and execute trades on the Avantis platform.

## Features

- **Complete Trading Lifecycle**: Open, close, modify, and manage perpetual positions
- **Real-time Price Feeds**: WebSocket integration with Pyth Network for live price updates
- **Market Data**: Access open interest, utilization, skew, fees, and liquidity depth
- **Flexible Signing**: Support for local private keys and AWS KMS for secure transaction signing
- **Type-Safe**: Full TypeScript support with Zod validation
- **Modular Architecture**: Clean separation of concerns with RPC modules

## Installation

```bash
npm install avantis-trader-sdk
```

Or with yarn:

```bash
yarn add avantis-trader-sdk
```

## Quick Start

```typescript
import { TraderClient, TradeInput, TradeInputOrderType } from 'avantis-trader-sdk';

// Initialize client
const client = new TraderClient('https://your-rpc-endpoint.com');

// Set up signer
client.setLocalSigner('your-private-key');

// Get market snapshot
const snapshot = await client.snapshotRPC.getSnapshot();

// Open a trade
const tradeInput: TradeInput = {
  pair: 'BTC/USD',
  isLong: true,
  collateralInTrade: 100,
  leverage: 10,
  openPrice: 0, // Market order
  tp: 0,
  sl: 0,
  orderType: TradeInputOrderType.MARKET,
  maxSlippageP: 1,
};

const tradeTx = await client.tradeRPC.buildTradeOpenTx(tradeInput);
const receipt = await client.signAndGetReceipt(tradeTx);
console.log('Trade executed:', receipt?.hash);
```

## Architecture

### Main Components

#### TraderClient
Main entry point for interacting with Avantis smart contracts. Provides access to all RPC modules and handles transaction signing.

```typescript
const client = new TraderClient(
  providerUrl: string,
  signer?: BaseSigner,
  feedClient?: FeedClient
);
```

#### Signers

**LocalSigner** - Sign transactions with a private key:
```typescript
client.setLocalSigner('0x...');
```

**KMSSigner** - Sign transactions with AWS KMS (private key never leaves HSM):
```typescript
client.setAwsKmsSigner('kms-key-id', 'us-east-1');
```

**Custom Signer** - Implement `BaseSigner` for custom signing logic:
```typescript
class CustomSigner extends BaseSigner {
  async signTransaction(tx: TransactionRequest): Promise<string> {
    // Your custom signing logic
  }
  async getAddress(): Promise<string> {
    // Return address
  }
}
```

#### FeedClient
WebSocket client for real-time price feeds from Pyth Network:

```typescript
import { FeedClient } from 'avantis-trader-sdk';

const feedClient = new FeedClient();

// Get Pyth feed IDs from the SDK
const btcPairIndex = await client.pairsCache.getPairIndex('BTC/USD');
const btcPairData = await client.pairsCache.getPairBackend(btcPairIndex!);
const pythFeedId = btcPairData.pair.feed.feedId;

// Register callback for price updates
feedClient.registerPriceFeedCallback(pythFeedId, (priceData) => {
  console.log('Price update:', priceData);
});

await feedClient.listenForPriceUpdates();
```

**Getting Pyth Feed IDs from the SDK:**
```typescript
// Get Pyth ID for a specific pair
const pairIndex = await client.pairsCache.getPairIndex('BTC/USD');
const pairData = await client.pairsCache.getPairBackend(pairIndex!);
console.log('Pyth Feed ID:', pairData.pair.feed.feedId);

// Get all Pyth IDs
const allPairs = await client.pairsCache.getPairsInfo();
for (const [pairIndex, pairInfo] of allPairs) {
  const data = await client.pairsCache.getPairBackend(pairIndex);
  console.log(`${pairInfo.from}/${pairInfo.to}: ${data.pair.feed.feedId}`);
}
```

### RPC Modules

#### PairsCache
Manages trading pair information with caching:

```typescript
// Get all pairs
const pairs = await client.pairsCache.getPairsInfo();

// Get pair by name
const pairIndex = await client.pairsCache.getPairIndex('BTC/USD');

// Get pairs in a category
const pairsInGroup = await client.pairsCache.getPairsInGroup(0);
```

#### AssetParametersRPC
Retrieve asset-level parameters:

```typescript
// Get open interest
const oi = await client.assetParams.getOI();

// Get utilization
const utilization = await client.assetParams.getUtilization();

// Get asset skew
const skew = await client.assetParams.getAssetSkew();

// Get price impact
const impact = await client.assetParams.getPriceImpactSpread(
  positionSize,
  isLong,
  pairIndex
);
```

#### CategoryParametersRPC
Retrieve category-level parameters (grouped pairs):

```typescript
// Get category OI
const categoryOI = await client.categoryParams.getOI();

// Get category utilization
const categoryUtil = await client.categoryParams.getUtilization();

// Get category skew
const categorySkew = await client.categoryParams.getCategorySkew();
```

#### FeeParametersRPC
Fee calculations:

```typescript
// Get margin fees
const fees = await client.feeParams.getMarginFee();

// Get opening fee
const openingFee = await client.feeParams.getOpeningFee(
  positionSize,
  isLong,
  pairIndex
);

// Get fee with referral discount
const feeWithReferral = await client.feeParams.getNewTradeOpeningFee(
  tradeInput,
  referrerAddress
);
```

#### TradingParametersRPC
Trading-related parameters:

```typescript
// Get loss protection info
const lossProtection = await client.tradingParams.getLossProtectionInfo(
  tradeInput,
  openingFee
);
```

#### BlendedRPC
Blended calculations (25% asset + 75% category):

```typescript
// Get blended utilization
const blendedUtil = await client.blendedParams.getBlendedUtilization();

// Get blended skew
const blendedSkew = await client.blendedParams.getBlendedSkew();
```

#### TradeRPC
Trading operations:

```typescript
// Open trade
const openTx = await client.tradeRPC.buildTradeOpenTx(tradeInput);

// Close trade
const closeTx = await client.tradeRPC.buildTradeCloseTx(pairIndex, tradeIndex);

// Update margin
const marginTx = await client.tradeRPC.buildTradeMarginUpdateTx(
  pairIndex,
  tradeIndex,
  marginDelta,
  MarginUpdateType.DEPOSIT
);

// Update TP/SL
const tpSlTx = await client.tradeRPC.buildTradeTpSlUpdateTx(
  pairIndex,
  tradeIndex,
  newTp,
  newSl
);

// Cancel order
const cancelTx = await client.tradeRPC.buildOrderCancelTx(pairIndex, orderIndex);

// Get all trades
const trades = await client.tradeRPC.getTrades(traderAddress);
```

#### SnapshotRPC
Aggregate all market data:

```typescript
// Get complete market snapshot
const snapshot = await client.snapshotRPC.getSnapshot();

// Get group snapshot
const groupData = await client.snapshotRPC.getGroupSnapshot(groupIndex);

// Get pair snapshot
const pairData = await client.snapshotRPC.getPairSnapshot('BTC/USD');
```

## Types

### TradeInput
```typescript
interface TradeInput {
  pair: string;              // e.g., "BTC/USD"
  isLong: boolean;           // true = long, false = short
  collateralInTrade: number; // USDC collateral
  leverage: number;          // Leverage multiplier
  openPrice: number;         // Entry price (0 for market)
  tp: number;                // Take profit (0 to disable)
  sl: number;                // Stop loss (0 to disable)
  referrer?: string;         // Referrer address
  orderType: TradeInputOrderType;
  maxSlippageP: number;      // Max slippage percentage
}
```

### TradeInputOrderType
```typescript
enum TradeInputOrderType {
  MARKET = 'market',
  STOP_LIMIT = 'stop_limit',
  LIMIT = 'limit',
  MARKET_ZERO_FEE = 'market_zero_fee',
}
```

### Snapshot
Complete market state with all trading pairs, grouped by category, including OI, utilization, skew, fees, and depth.

## Configuration

Update contract addresses for your network:

```typescript
import { setContractAddresses } from 'avantis-trader-sdk';

setContractAddresses({
  TradingStorage: '0x...',
  PairStorage: '0x...',
  Trading: '0x...',
  USDC: '0x...',
  // ... other contracts
});
```

## Examples

See the `/examples` directory for complete examples:

- `basic-usage.ts` - Basic trading operations
- `price-feed.ts` - Real-time price feed integration
- `kms-signer.ts` - AWS KMS signing

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test
```

## Requirements

- Node.js 16+
- TypeScript 5+

## Dependencies

- **ethers** - Ethereum interaction
- **zod** - Data validation
- **ws** - WebSocket client
- **@aws-sdk/client-kms** - AWS KMS integration (optional)

## Platform Information

**Avantis** is a leveraged trading platform supporting:
- Perpetual contracts on cryptocurrencies, forex, and commodities
- Up to 100x leverage
- USDC liquidity pool
- Decentralized architecture

## Resources

- [Python SDK](https://github.com/Avantis-Labs/avantis_trader_sdk)
- [Avantis Documentation](https://docs.avantisfi.com/)
- [SDK Documentation](https://sdk.avantisfi.com/)

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## Security

**Warning**: Never commit private keys or sensitive credentials. Use environment variables or secure key management systems like AWS KMS for production deployments.

## Support

For issues and questions:
- GitHub Issues: [Report an issue](https://github.com/your-repo/issues)
- Documentation: [SDK Documentation](https://sdk.avantisfi.com/)
