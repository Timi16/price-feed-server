/**
 * Avantis Trader SDK - TypeScript
 *
 * A comprehensive SDK for interacting with the Avantis decentralized
 * leveraged trading platform.
 */

// Main client
export { TraderClient } from './client';

// Signers
export { BaseSigner } from './signers/base';
export { LocalSigner } from './signers/local';
export { KMSSigner } from './signers/kms';

// Feed client
export { FeedClient, PriceUpdateCallback } from './feed/feed_client';

// RPC modules
export { PairsCache } from './rpc/pairs_cache';
export { AssetParametersRPC } from './rpc/asset_parameters';
export { CategoryParametersRPC } from './rpc/category_parameters';
export { FeeParametersRPC } from './rpc/fee_parameters';
export { TradingParametersRPC } from './rpc/trading_parameters';
export { BlendedRPC } from './rpc/blended';
export { TradeRPC } from './rpc/trade';
export { SnapshotRPC } from './rpc/snapshot';
export { TradingOperationsRPC } from './rpc/trading_operations';
export { DelegationRPC } from './rpc/delegation';
export { PairInfoQueriesRPC } from './rpc/pair_info_queries';
export { ReferralOperationsRPC } from './rpc/referral_operations';
export { MulticallRPC, type MulticallCall, type MulticallResult } from './rpc/multicall';

// Types and enums
export {
  TradeInputOrderType,
  MarginUpdateType,
  type Spread,
  type PairInfo,
  type TradeInput,
  type TradeResponse,
  type Price,
  type EmaPrice,
  type PriceFeedResponse,
  type OpenInterest,
  type OpenInterestLimits,
  type Utilization,
  type Skew,
  type Fee,
  type Depth,
  type LossProtectionInfo,
  type PairData,
  type Group,
  type Snapshot,
  type Trade,
  type TradeInfo,
  type OpenLimitOrder,
  type ReferralTier,
  type ReferralDiscount,
  type ContractCallOptions,
  type TransactionReceipt,
  type PairsBackendReturn,
  type ContractPairInfo,
  type PairStruct,
  type GroupStruct,
  type FeeStruct,
  type FeedStruct,
  type BackupFeedStruct,
  type LeverageStruct,
  type ValuesStruct,
  type PnlFeesStruct,
  fromBlockchain10,
  fromBlockchain6,
  toBlockchain10,
  toBlockchain6,
  fromBlockchain12,
  toBlockchain12,
  fromBlockchain18,
  toBlockchain18,
} from './types';

// Configuration
export {
  CONTRACTS,
  API_ENDPOINTS,
  type ContractAddresses,
  type NetworkConfig,
  getContractAddress,
  setContractAddresses,
} from './config';

// Utilities
export {
  isTupleType,
  isArrayType,
  processOutputTypes,
  decoder,
  hexToNumber,
  numberToHex,
  isValidAddress,
  toChecksumAddress,
  sleep,
  retryWithBackoff,
} from './utils';

// Crypto utilities (for advanced usage)
export {
  publicKeyIntToEthAddress,
  derEncodedPublicKeyToEthAddress,
  getSigRS,
  getSigV,
  getSigRSV,
  signatureToHex,
} from './crypto/spki';
