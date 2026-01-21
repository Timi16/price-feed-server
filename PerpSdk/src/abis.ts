/**
 * Contract ABIs for Avantis Protocol
 *
 * These ABIs contain the function signatures needed to interact with
 * the Avantis smart contracts.
 */

/**
 * ERC20 ABI (for USDC)
 */

import refferal from "./abis/Referral";
import trading from "./abis/Trading"
import erc20 from "./abis/erc20"
import pairStorage from "./abis/pairStorage"
import tradingStorage from "./abis/tardingStorage"
import pairinfos from "./abis/pairInfos"
import priceAggregator from "./abis/priceAggregator"
import referral from "./abis/Referral"
import multicall from "./abis/multicall"

export const ERC20_ABI = erc20;

/**
 * Trading Contract ABI
 */
export const TRADING_ABI = trading;

/**
 * TradingStorage Contract ABI
 */
export const TRADING_STORAGE_ABI = tradingStorage;

/**
 * PairStorage Contract ABI
 */
export const PAIR_STORAGE_ABI = pairStorage;

/**
 * PairInfos Contract ABI
 */
export const PAIR_INFOS_ABI = pairinfos;

/**
 * PriceAggregator Contract ABI
 */
export const PRICE_AGGREGATOR_ABI = priceAggregator;
/**
 * Referral Contract ABI
 */
export const REFERRAL_ABI = referral;

/**
 * Multicall Contract ABI
 */
export const MULTICALL_ABI = multicall;