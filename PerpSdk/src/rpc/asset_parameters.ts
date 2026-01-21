import { Contract, Provider } from 'ethers';
import {
  OpenInterest,
  OpenInterestLimits,
  Utilization,
  Skew,
  TradeInput,
  fromBlockchain6,
  fromBlockchain10,
} from '../types';
import { PairsCache } from './pairs_cache';

/**
 * RPC module for retrieving asset-level parameters
 */
export class AssetParametersRPC {
  private provider: Provider;
  private pairStorageContract: Contract;
  private pairInfosContract: Contract;
  private tradingStorageContract: Contract;
  private pairsCache: PairsCache;

  constructor(
    provider: Provider,
    pairStorageContract: Contract,
    pairInfosContract: Contract,
    pairsCache: PairsCache,
    tradingStorageContract: Contract
  ) {
    this.provider = provider;
    this.pairStorageContract = pairStorageContract;
    this.pairInfosContract = pairInfosContract;
    this.tradingStorageContract = tradingStorageContract;
    this.pairsCache = pairsCache;
  }

  /**
   * Get open interest limits for all pairs
   * @returns Map of pair index to OI limits
   */
  async getOILimits(): Promise<Map<number, OpenInterestLimits>> {
    const pairs = await this.pairsCache.getPairsInfo();
    const limits = new Map<number, OpenInterestLimits>();

    for (const [pairIndex, pairInfo] of pairs) {
      limits.set(pairIndex, {
        pairIndex,
        maxLong: pairInfo.maxLongOiP,
        maxShort: pairInfo.maxShortOiP,
      });
    }

    return limits;
  }

  /**
   * Get current open interest for all pairs
   * @returns Map of pair index to OI
   */
  async getOI(): Promise<Map<number, OpenInterest>> {
    const pairs = await this.pairsCache.getPairsInfo();
    const oi = new Map<number, OpenInterest>();

    for (const [pairIndex] of pairs) {
      try {
        // Use TradingStorage contract which has openInterestUSDC method
        const pairOILong = await this.tradingStorageContract.openInterestUSDC(pairIndex, 0); // 0 = long
        const pairOIShort = await this.tradingStorageContract.openInterestUSDC(pairIndex, 1); // 1 = short

        const limits = await this.getOILimits();
        const maxOI = limits.get(pairIndex)?.maxLong || 0;

        oi.set(pairIndex, {
          long: fromBlockchain6(pairOILong),
          short: fromBlockchain6(pairOIShort),
          max: maxOI,
        });
      } catch (error) {
        console.error(`Error getting OI for pair ${pairIndex}:`, error);
        // Set default values on error
        oi.set(pairIndex, {
          long: 0,
          short: 0,
          max: 0,
        });
      }
    }

    return oi;
  }

  /**
   * Get utilization for all pairs
   * @returns Map of pair index to utilization
   */
  async getUtilization(): Promise<Map<number, Utilization>> {
    const oi = await this.getOI();
    const utilization = new Map<number, Utilization>();

    for (const [pairIndex, oiData] of oi) {
      const utilizationLong = oiData.max > 0 ? (oiData.long / oiData.max) * 100 : 0;
      const utilizationShort = oiData.max > 0 ? (oiData.short / oiData.max) * 100 : 0;

      utilization.set(pairIndex, {
        utilizationLong,
        utilizationShort,
      });
    }

    return utilization;
  }

  /**
   * Get asset skew (long / total) for all pairs
   * @returns Map of pair index to skew
   */
  async getAssetSkew(): Promise<Map<number, Skew>> {
    const oi = await this.getOI();
    const skew = new Map<number, Skew>();

    for (const [pairIndex, oiData] of oi) {
      const total = oiData.long + oiData.short;
      const skewValue = total > 0 ? oiData.long / total : 0.5;

      skew.set(pairIndex, { skew: skewValue });
    }

    return skew;
  }

  /**
   * Get price impact spread for opening a position
   * @param positionSize - Position size in USDC
   * @param isLong - True for long, false for short
   * @param pairIndex - Pair index
   * @returns Price impact spread percentage
   */
  async getPriceImpactSpread(
    positionSize: number,
    isLong: boolean,
    pairIndex: number
  ): Promise<number> {
    try {
      const result = await this.pairInfosContract.getPriceImpactP(
        pairIndex,
        isLong,
        BigInt(Math.floor(positionSize * 1e6))
      );
      return fromBlockchain10(result);
    } catch (error) {
      console.error('Error getting price impact spread:', error);
      return 0;
    }
  }

  /**
   * Get skew impact spread
   * @param pairIndex - Pair index
   * @returns Skew impact spread
   */
  async getSkewImpactSpread(pairIndex: number): Promise<number> {
    try {
      const skewMap = await this.getAssetSkew();
      const skew = skewMap.get(pairIndex);

      if (!skew) return 0;

      // Simple skew impact calculation (can be customized)
      const deviation = Math.abs(skew.skew - 0.5);
      return deviation * 100; // Convert to basis points
    } catch (error) {
      console.error('Error getting skew impact spread:', error);
      return 0;
    }
  }

  /**
   * Get opening price impact spread for a trade
   * @param tradeInput - Trade input parameters
   * @returns Opening price impact spread
   */
  async getOpeningPriceImpactSpread(tradeInput: TradeInput): Promise<number> {
    const pairIndex = await this.pairsCache.getPairIndex(tradeInput.pair);
    if (pairIndex === undefined) {
      throw new Error(`Pair ${tradeInput.pair} not found`);
    }

    const positionSize = tradeInput.collateralInTrade * tradeInput.leverage;
    return await this.getPriceImpactSpread(positionSize, tradeInput.isLong, pairIndex);
  }

  /**
   * Get one percent depth (liquidity depth)
   * @returns Map of pair index to depth
   */
  async getOnePercentDepth(): Promise<Map<number, { above: number; below: number }>> {
    const pairs = await this.pairsCache.getPairsInfo();
    const depth = new Map<number, { above: number; below: number }>();

    for (const [pairIndex] of pairs) {
      try {
        const depthAbove = await this.pairInfosContract.onePercentDepthAboveUsdc(pairIndex);
        const depthBelow = await this.pairInfosContract.onePercentDepthBelowUsdc(pairIndex);

        depth.set(pairIndex, {
          above: fromBlockchain6(depthAbove),
          below: fromBlockchain6(depthBelow),
        });
      } catch (error) {
        // If method doesn't exist, set default values
        depth.set(pairIndex, { above: 0, below: 0 });
      }
    }

    return depth;
  }
}
