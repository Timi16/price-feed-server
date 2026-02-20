import { z } from 'zod';

// ========== ENUMS ==========

export enum TradeInputOrderType {
  MARKET = 'market',
  STOP_LIMIT = 'stop_limit',
  LIMIT = 'limit',
  MARKET_ZERO_FEE = 'market_zero_fee',
}

export enum MarginUpdateType {
  DEPOSIT = 0,
  WITHDRAW = 1,
}

// ========== ZOD SCHEMAS ==========

// Address validation
const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);

// Spread schema
export const SpreadSchema = z.object({
  min: z.number(),
  max: z.number(),
});

// PairInfo schema
export const PairInfoSchema = z.object({
  from: z.string(),
  to: z.string(),
  spread: SpreadSchema,
  groupIndex: z.number(),
  feeIndex: z.number(),
  maxLeverage: z.number(),
  maxLongOiP: z.number(),
  maxShortOiP: z.number(),
 
  // maxOpenInterestUsdc: z.number(),
});

// TradeInput schema
export const TradeInputSchema = z.object({
  pair: z.string(),
  isLong: z.boolean(),
  collateralInTrade: z.number(),
  leverage: z.number(),
  openPrice: z.number(),
  tp: z.number(),
  sl: z.number(),
  referrer: addressSchema.optional().default('0x0000000000000000000000000000000000000000'),
  orderType: z.nativeEnum(TradeInputOrderType),
  maxSlippageP: z.number(),
  timestamp: z.number(),
});

// TradeResponse schema
export const TradeResponseSchema = z.object({
  trader: addressSchema,
  pairIndex: z.number(),
  index: z.number(),
  initialPosUsdc: z.number(),
  openPrice: z.number(),
  buy: z.boolean(),
  leverage: z.number(),
  tp: z.number(),
  sl: z.number(),
});

// Price schema (from Pyth)
export const PriceSchema = z.object({
  price: z.string(),
  conf: z.string(),
  expo: z.number(),
  publishTime: z.number(),
});

// EmaPrice schema
export const EmaPriceSchema = z.object({
  price: z.string(),
  conf: z.string(),
  expo: z.number(),
  publishTime: z.number(),
});

// PriceFeedResponse schema
export const PriceFeedResponseSchema = z.object({
  id: z.string(),
  price: PriceSchema,
  emaPrice: EmaPriceSchema,
});

// OpenInterest schema
export const OpenInterestSchema = z.object({
  long: z.number(),
  short: z.number(),
  max: z.number(),
});

// OpenInterestLimits schema
export const OpenInterestLimitsSchema = z.object({
  pairIndex: z.number(),
  maxLong: z.number(),
  maxShort: z.number(),
});

// Utilization schema
export const UtilizationSchema = z.object({
  utilizationLong: z.number(),
  utilizationShort: z.number(),
});

// Skew schema
export const SkewSchema = z.object({
  skew: z.number(),
});

// Fee schema
export const FeeSchema = z.object({
  feeP: z.number(),
});

// Depth schema
export const DepthSchema = z.object({
  onePercentDepthAboveUsdc: z.number(),
  onePercentDepthBelowUsdc: z.number(),
});

// LossProtectionInfo schema
export const LossProtectionInfoSchema = z.object({
  tier: z.number(),
  percentage: z.number(),
  amount: z.number(),
});

// PairData schema (for snapshot)
export const PairDataSchema = z.object({
  pairInfo: PairInfoSchema,
  openInterest: OpenInterestSchema.optional(),
  utilization: UtilizationSchema.optional(),
  skew: SkewSchema.optional(),
  fee: FeeSchema.optional(),
  depth: DepthSchema.optional(),
  spread: z.number().optional(),
});

// Group schema (for snapshot)
export const GroupSchema = z.object({
  groupIndex: z.number(),
  pairs: z.record(z.string(), PairDataSchema),
  openInterest: OpenInterestSchema.optional(),
  utilization: UtilizationSchema.optional(),
  skew: SkewSchema.optional(),
});

// Snapshot schema
export const SnapshotSchema = z.object({
  groups: z.record(z.string(), GroupSchema),
});

// Trade schema (from smart contract)
export const TradeSchema = z.object({
  trader: addressSchema,
  pairIndex: z.number(),
  index: z.number(),
  initialPosToken: z.number(), // 6 decimals
  positionSizeUSDC: z.number(), // 6 decimals
  openPrice: z.number(), // 10 decimals
  buy: z.boolean(),
  leverage: z.number(), // 10 decimals
  tp: z.number(), // 10 decimals
  sl: z.number(), // 10 decimals
  timestamp: z.number(),
});

// TradeInfo schema (from smart contract)
export const TradeInfoSchema = z.object({
  openInterestUSDC: z.number(), // 6 decimals
  tpLastUpdated: z.number(),
  slLastUpdated: z.number(),
  beingMarketClosed: z.boolean(),
  lossProtection: z.number(),
});

// OpenLimitOrder schema (from smart contract)
export const OpenLimitOrderSchema = z.object({
  trader: addressSchema,
  pairIndex: z.number(),
  index: z.number(),
  positionSize: z.number(), // 6 decimals
  buy: z.boolean(),
  leverage: z.number(), // 10 decimals
  tp: z.number(), // 10 decimals
  sl: z.number(), // 10 decimals
  price: z.number(), // 10 decimals
  slippageP: z.number(), // 10 decimals
  block: z.number(),
  executionFee: z.number(), // 18 decimals
});

// ReferralTier schema
export const ReferralTierSchema = z.object({
  feeDiscountPct: z.number(),
  refRebatePct: z.number(),
});

// ReferralDiscount schema
export const ReferralDiscountSchema = z.object({
  traderDiscount: z.number(),
  referrer: addressSchema,
  rebateShare: z.number(),
});

// ========== TYPESCRIPT TYPES ==========

export type Spread = z.infer<typeof SpreadSchema>;
export type PairInfo = z.infer<typeof PairInfoSchema>;
export type TradeInput = z.infer<typeof TradeInputSchema>;
export type TradeResponse = z.infer<typeof TradeResponseSchema>;
export type Price = z.infer<typeof PriceSchema>;
export type EmaPrice = z.infer<typeof EmaPriceSchema>;
export type PriceFeedResponse = z.infer<typeof PriceFeedResponseSchema>;
export type OpenInterest = z.infer<typeof OpenInterestSchema>;
export type OpenInterestLimits = z.infer<typeof OpenInterestLimitsSchema>;
export type Utilization = z.infer<typeof UtilizationSchema>;
export type Skew = z.infer<typeof SkewSchema>;
export type Fee = z.infer<typeof FeeSchema>;
export type Depth = z.infer<typeof DepthSchema>;
export type LossProtectionInfo = z.infer<typeof LossProtectionInfoSchema>;
export type PairData = z.infer<typeof PairDataSchema>;
export type Group = z.infer<typeof GroupSchema>;
export type Snapshot = z.infer<typeof SnapshotSchema>;
export type Trade = z.infer<typeof TradeSchema>;
export type TradeInfo = z.infer<typeof TradeInfoSchema>;
export type OpenLimitOrder = z.infer<typeof OpenLimitOrderSchema>;
export type ReferralTier = z.infer<typeof ReferralTierSchema>;
export type ReferralDiscount = z.infer<typeof ReferralDiscountSchema>;

// ========== UTILITY TYPES ==========

export interface ContractCallOptions {
  value?: bigint;
  gasLimit?: bigint;
}

export interface TransactionReceipt {
  transactionHash: string;
  blockNumber: number;
  status: number;
  gasUsed: bigint;
}

// ========== CONVERSION HELPERS ==========

/**
 * Convert blockchain integer to decimal (10^10 precision)
 */
export function fromBlockchain10(value: bigint | number | string): number {
  return Number(BigInt(value)) / 1e10;
}

/**
 * Convert blockchain integer to decimal (10^6 precision for USDC)
 */
export function fromBlockchain6(value: bigint | number | string): number {
  return Number(BigInt(value)) / 1e6;
}

/**
 * Convert decimal to blockchain integer (10^10 precision)
 */
export function toBlockchain10(value: number): bigint {
  return BigInt(Math.floor(value * 1e10));
}

/**
 * Convert decimal to blockchain integer (10^6 precision for USDC)
 */
export function toBlockchain6(value: number): bigint {
  return BigInt(Math.floor(value * 1e6));
}

/**
 * Convert blockchain integer to decimal (10^12 precision for fees)
 */
export function fromBlockchain12(value: bigint | number | string): number {
  return Number(BigInt(value)) / 1e12;
}

/**
 * Convert decimal to blockchain integer (10^12 precision for fees)
 */
export function toBlockchain12(value: number): bigint {
  return BigInt(Math.floor(value * 1e12));
}

/**
 * Convert blockchain integer to decimal (10^18 precision for ETH/execution fees)
 */
export function fromBlockchain18(value: bigint | number | string): number {
  return Number(BigInt(value)) / 1e18;
}

/**
 * Convert decimal to blockchain integer (10^18 precision for ETH/execution fees)
 */
export function toBlockchain18(value: number): bigint {
  return BigInt(Math.floor(value * 1e18));
}


export interface ContractPairInfo {
  feed: {
    maxOpenDeviationP: bigint;
    maxCloseDeviationP: bigint;
    feedId: string; // bytes32
  };
  backupFeed: {
    maxDeviationP: bigint;
    feedId: string; // address
  };
  spreadP: bigint;
  pnlSpreadP: bigint;
  leverages: {
    minLeverage: bigint;
    maxLeverage: bigint;
    pnlMinLeverage: bigint;
    pnlMaxLeverage: bigint;
  };
  priceImpactMultiplier: bigint;
  skewImpactMultiplier: bigint; // int256
  groupIndex: bigint;
  feeIndex: bigint;
  values: {
    maxGainP: bigint;   // int256
    maxSlP: bigint;     // int256
    maxLongOiP: bigint;
    maxShortOiP: bigint;
    groupOpenInterestPercentageP: bigint;
    maxWalletOIP: bigint;
    isUSDCAligned: boolean;
  };
}


export interface FeedStruct {
  maxOpenDeviationP: bigint;
  maxCloseDeviationP: bigint;
  feedId: string; // bytes32
}

export interface BackupFeedStruct {
  maxDeviationP: bigint;
  feedId: string; // address
}

export interface LeverageStruct {
  minLeverage: bigint;
  maxLeverage: bigint;
  pnlMinLeverage: bigint;
  pnlMaxLeverage: bigint;
}

export interface ValuesStruct {
  maxGainP: bigint;
  maxSlP: bigint;
  maxLongOiP: bigint;
  maxShortOiP: bigint;
  groupOpenInterestPercentageP: bigint;
  maxWalletOIP: bigint;
  isUSDCAligned: boolean;
}

export interface PairStruct {
  feed: FeedStruct;
  backupFeed: BackupFeedStruct;
  spreadP: bigint;
  pnlSpreadP: bigint;
  leverages: LeverageStruct;
  priceImpactMultiplier: bigint;
  skewImpactMultiplier: bigint;
  groupIndex: bigint;
  feeIndex: bigint;
  values: ValuesStruct;
}

export interface GroupStruct {
  name: string;
  maxOpenInterestP: bigint;
  isSpreadDynamic: boolean;
}

export interface PnlFeesStruct {
  numTiers: bigint;
  tierP: bigint[];
  feesP: bigint[];
}

export interface FeeStruct {
  openFeeP: bigint;
  closeFeeP: bigint;
  limitOrderFeeP: bigint;
  minLevPosUSDC: bigint;
  pnlFees: PnlFeesStruct;
}

export type PairsBackendReturn = {
  pair: PairStruct;
  group: GroupStruct;
  fee: FeeStruct;
};